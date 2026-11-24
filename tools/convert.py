# Run: uv run --python 3.13 --no-project --with torch --with onnx --with onnxruntime --with numpy python tools/convert.py realesr-general-x4v3.pth public/models/realesr-general-x4v3.onnx
"""Converts the official realesr-general-x4v3.pth (SRVGGNetCompact) to ONNX and checks the ONNX output matches PyTorch."""
import sys, numpy as np, torch, torch.nn as nn, torch.nn.functional as F, onnxruntime as ort

class SRVGGNetCompact(nn.Module):
    # Same layout as basicsr/archs/srvgg_arch.py, so the official state_dict keys load unchanged.
    def __init__(self, num_feat=64, num_conv=32, upscale=4):
        super().__init__()
        self.upscale = upscale
        self.body = nn.ModuleList([nn.Conv2d(3, num_feat, 3, 1, 1), nn.PReLU(num_parameters=num_feat)])
        for _ in range(num_conv):
            self.body.append(nn.Conv2d(num_feat, num_feat, 3, 1, 1))
            self.body.append(nn.PReLU(num_parameters=num_feat))
        self.body.append(nn.Conv2d(num_feat, 3 * upscale * upscale, 3, 1, 1))
        self.upsampler = nn.PixelShuffle(upscale)
    def forward(self, x):
        out = x
        for layer in self.body: out = layer(out)
        out = self.upsampler(out)
        return out + F.interpolate(x, scale_factor=self.upscale, mode='nearest')

src, dst = sys.argv[1], sys.argv[2]
state = torch.load(src, map_location='cpu', weights_only=True)
state = state.get('params_ema', state.get('params', state))
net = SRVGGNetCompact(); net.load_state_dict(state, strict=True); net.eval()
x = torch.rand(1, 3, 64, 48)
torch.onnx.export(net, x, dst, input_names=['input'], output_names=['output'], opset_version=17,
                  dynamic_axes={'input': {2: 'h', 3: 'w'}, 'output': {2: 'h4', 3: 'w4'}}, dynamo=False)
t = torch.rand(1, 3, 72, 100)
with torch.no_grad(): ref = net(t).numpy()
got = ort.InferenceSession(dst).run(None, {'input': t.numpy()})[0]
print('shape', got.shape, 'max abs diff', float(np.abs(ref - got).max()))
assert got.shape == (1, 3, 288, 400) and np.abs(ref - got).max() < 1e-3
