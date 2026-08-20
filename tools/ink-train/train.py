# ─────────────────────────────────────────────────────────────────────────────
# Trains the v6 ink-classifier ENSEMBLE (model A @28², model B @32²) and
# exports int8-quantised weights as a JS module the on-device forward pass
# (client/src/ink/nn.js) consumes. Cutout augmentation teaches robustness to
# broken/occluded strokes.
# ─────────────────────────────────────────────────────────────────────────────
import json, base64, time, os
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F

torch.manual_seed(7)
np.random.seed(7)
torch.set_num_threads(max(1, torch.get_num_threads()))

# Apple Silicon's GPU trains this ensemble several times faster than the CPU
# path, which is what makes the enlarged, heavier-tailed set from gen.mjs
# affordable. Falls back silently where it is absent, and the exported weights
# are identical either way — everything returns to the CPU before quantisation.
DEV = torch.device('mps') if torch.backends.mps.is_available() else torch.device('cpu')
print('device:', DEV)

OUT_JS = __import__('os').environ.get('PRI_OUT_JS', '../../client/src/ink/model-data.js')
D = '/tmp/inktrain'

man = json.load(open(f'{D}/manifest.json'))
C = len(man['classes'])

def load(name, size, n):
    x = np.frombuffer(open(f'{D}/{name}{size}.img','rb').read(), dtype=np.uint8).reshape(n, 1, size, size).astype(np.float32)/255.0
    return torch.from_numpy(x)

def load_lbl(name, n):
    return torch.from_numpy(np.frombuffer(open(f'{D}/{name}.lbl','rb').read(), dtype=np.uint8).astype(np.int64))

yt = load_lbl('train', man['train']); yv = load_lbl('val', man['val'])

class NetA(nn.Module):           # 28² — v7: widened v5 architecture
    def __init__(self):
        super().__init__()
        self.c1 = nn.Conv2d(1, 20, 3, padding=1)
        self.c2 = nn.Conv2d(20, 40, 3, padding=1)
        self.c3 = nn.Conv2d(40, 56, 3, padding=1)
        self.f1 = nn.Linear(56*3*3, 160)
        self.f2 = nn.Linear(160, C)
    def forward(self, x):
        x = F.max_pool2d(F.relu(self.c1(x)), 2)   # 14
        x = F.max_pool2d(F.relu(self.c2(x)), 2)   # 7
        x = F.max_pool2d(F.relu(self.c3(x)), 2)   # 3
        x = x.flatten(1)
        x = F.relu(self.f1(x))
        x = F.dropout(x, 0.15, self.training)
        return self.f2(x)

class NetB(nn.Module):           # 32² — deeper, wider
    def __init__(self):
        super().__init__()
        self.c1 = nn.Conv2d(1, 20, 3, padding=1)
        self.c2 = nn.Conv2d(20, 40, 3, padding=1)
        self.c3 = nn.Conv2d(40, 64, 3, padding=1)
        self.f1 = nn.Linear(64*4*4, 192)
        self.f2 = nn.Linear(192, C)
    def forward(self, x):
        x = F.max_pool2d(F.relu(self.c1(x)), 2)   # 16
        x = F.max_pool2d(F.relu(self.c2(x)), 2)   # 8
        x = F.max_pool2d(F.relu(self.c3(x)), 2)   # 4
        x = x.flatten(1)
        x = F.relu(self.f1(x))
        x = F.dropout(x, 0.2, self.training)
        return self.f2(x)

def cutout(xb):
    """Zero a random patch on ~30% of samples — broken-stroke robustness."""
    n, _, H, W = xb.shape
    mask_n = int(n*0.3)
    if mask_n == 0: return xb
    idx = torch.randperm(n)[:mask_n]
    xb = xb.clone()
    for i in idx.tolist():
        s = np.random.randint(4, 7)
        y0 = np.random.randint(0, H - s); x0 = np.random.randint(0, W - s)
        xb[i, :, y0:y0+s, x0:x0+s] = 0
    return xb

def train_model(net, size, epochs, tag):
    xt = load('train', size, man['train']); xv = load('val', size, man['val'])
    print(f'[{tag}] train {tuple(xt.shape)} val {tuple(xv.shape)} params {sum(p.numel() for p in net.parameters())}')
    net = net.to(DEV)
    xv = xv.to(DEV)
    opt = torch.optim.Adam(net.parameters(), lr=1.2e-3)
    sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=epochs)
    BS = 256
    def evaluate():
        net.eval(); correct = 0
        with torch.no_grad():
            for i in range(0, len(xv), 1024):
                correct += (net(xv[i:i+1024]).argmax(1).cpu() == yv[i:i+1024]).sum().item()
        net.train(); return correct/len(xv)
    t0 = time.time()
    for epoch in range(epochs):
        perm = torch.randperm(len(xt))
        tot, correct, lsum = 0, 0, 0.0
        for i in range(0, len(xt), BS):
            idx = perm[i:i+BS]
            xb, yb = cutout(xt[idx]).to(DEV), yt[idx].to(DEV)
            out = net(xb)
            loss = F.cross_entropy(out, yb, label_smoothing=0.05)
            opt.zero_grad(); loss.backward(); opt.step()
            lsum += loss.item()*len(idx); tot += len(idx)
            correct += (out.argmax(1) == yb).sum().item()
        sched.step()
        print(f'[{tag}] epoch {epoch+1}/{epochs}: loss {lsum/tot:.4f} train {100*correct/tot:.2f}% val {100*evaluate():.2f}% ({time.time()-t0:.0f}s)', flush=True)
    acc = evaluate()
    print(f'[{tag}] FINAL VAL ACC {100*acc:.2f}%')
    # logits on val for ensemble measurement
    net.eval()
    with torch.no_grad():
        probs = torch.cat([F.softmax(net(xv[i:i+1024]), 1).cpu() for i in range(0, len(xv), 1024)])
    return acc, probs, xv

netA = NetA(); accA, probsA, xvA = train_model(netA, 28, int(os.environ.get('PRI_EPOCHS_A', 18)), 'A28')
netB = NetB(); accB, probsB, xvB = train_model(netB, 32, int(os.environ.get('PRI_EPOCHS_B', 20)), 'B32')

ens = ((probsA + probsB) / 2).argmax(1)
accE = (ens == yv).float().mean().item()
print(f'ENSEMBLE VAL ACC {100*accE:.2f}%  (A {100*accA:.2f}%  B {100*accB:.2f}%)')

bad = {}
for p, y in zip(ens.tolist(), yv.tolist()):
    if p != y:
        k = f"{man['classes'][y]}→{man['classes'][p]}"
        bad[k] = bad.get(k, 0)+1
print('top ensemble confusions:', sorted(bad.items(), key=lambda kv: -kv[1])[:12])

# ── export int8 ──
def q(t):
    a = t.detach().cpu().numpy().astype(np.float32)
    s = float(np.max(np.abs(a))/127.0) or 1e-8
    qa = np.clip(np.round(a/s), -127, 127).astype(np.int8)
    return {'shape': list(a.shape), 'scale': s, 'b64': base64.b64encode(qa.tobytes()).decode()}

def fb(t):
    a = t.detach().cpu().numpy().astype(np.float32)
    return {'shape': list(a.shape), 'b64': base64.b64encode(a.tobytes()).decode()}

def export(net, size, acc):
    return {
        'img': size, 'val_acc': round(acc, 4),
        'c1w': q(net.c1.weight), 'c1b': fb(net.c1.bias),
        'c2w': q(net.c2.weight), 'c2b': fb(net.c2.bias),
        'c3w': q(net.c3.weight), 'c3b': fb(net.c3.bias),
        'f1w': q(net.f1.weight), 'f1b': fb(net.f1.bias),
        'f2w': q(net.f2.weight), 'f2b': fb(net.f2.bias),
    }

model = {'classes': man['classes'], 'val_acc': round(accE, 4),
         'models': [export(netA, 28, accA), export(netB, 32, accB)]}
js = '// Generated by tools/ink-train/train.py — int8-quantised v6 ink ensemble.\n' \
     f'// ensemble val {100*accE:.2f}% (A28 {100*accA:.2f}%, B32 {100*accB:.2f}%) on {len(yv)} held-out samples ({C} classes).\n' \
     'export default ' + json.dumps(model) + ';\n'
open(OUT_JS, 'w').write(js)
print('wrote', OUT_JS, f'{len(js)/1024:.0f} KB')

# quantised sanity check: rerun val through int8-dequantised weights
def dq(d):
    return (np.frombuffer(base64.b64decode(d['b64']), dtype=np.int8).astype(np.float32)*d['scale']).reshape(d['shape'])
def requant(net, ex):
    with torch.no_grad():
        for k in ['c1','c2','c3','f1','f2']:
            getattr(net, k).weight.copy_(torch.from_numpy(dq(ex[k+'w'])).to(DEV))
requant(netA, model['models'][0]); requant(netB, model['models'][1])
with torch.no_grad():
    pA = torch.cat([F.softmax(netA(xvA[i:i+1024]),1).cpu() for i in range(0, len(xvA), 1024)])
    pB = torch.cat([F.softmax(netB(xvB[i:i+1024]),1).cpu() for i in range(0, len(xvB), 1024)])
accQ = (((pA+pB)/2).argmax(1) == yv).float().mean().item()
print(f'INT8 ENSEMBLE VAL ACC {100*accQ:.2f}%')
