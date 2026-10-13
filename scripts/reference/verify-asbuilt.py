import hashlib, io, struct, zipfile, json, re
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.x509 import load_der_x509_certificate
data = open('out/DeepSeekHarness-ZhaoHua-v181lite9b.apk','rb').read()
idx = data.rfind(b'PK\x05\x06')
cd_off = struct.unpack_from('<I', data, idx+16)[0]
fs = struct.unpack_from('<Q', data, cd_off-24)[0]
blk = cd_off - 8 - fs
pos = blk + 8; v2 = None
while pos < cd_off-24:
    plen = struct.unpack_from('<Q', data, pos)[0]
    if struct.unpack_from('<I', data, pos+8)[0] == 0x7109871a:
        v2 = data[pos+12:pos+8+plen]
    pos += 8+plen
sn = struct.unpack_from('<I', v2, 4)[0]
signer = v2[8:8+sn]
m = struct.unpack_from('<I', signer, 0)[0]
sd = signer[4:4+m]
rest = signer[4+m:]
m2 = struct.unpack_from('<I', rest, 0)[0]
sigs = rest[4:4+m2]
sa = struct.unpack_from('<I', sigs, 4)[0]; sl = struct.unpack_from('<I', sigs, 8)[0]
sig = sigs[12:12+sl]
eocd = bytearray(data[idx:]); struct.pack_into('<I', eocd, 16, blk)
def chunked(sec):
    out=[]; p=0
    if not sec: return b''
    while p < len(sec):
        c = sec[p:p+1048576]
        out.append(hashlib.sha256(b'\xa5'+struct.pack('<I',len(c))+c).digest()); p += 1048576
    return b''.join(out)
secs = [data[:blk], data[cd_off:idx], bytes(eocd)]
total = sum((len(s)+1048575)//1048576 for s in secs)
digest = hashlib.sha256(b'\x5a'+struct.pack('<I',total)+b''.join(chunked(s) for s in secs)).digest()
assert sd[16:48] == digest
cert = load_der_x509_certificate(open('out/zh.cert.der','rb').read())
cert.public_key().verify(sig, sd, padding.PKCS1v15(), hashes.SHA256())
print('SIGNATURE VALID')
z = zipfile.ZipFile(io.BytesIO(data))
p = zipfile.ZipFile(io.BytesIO(z.read('assets/payload.zip')))
PP = 'dshroot/lib/node_modules/@zhaohua/dsh-prompt-switch/'
assert PP + 'prompts/default.txt' in p.namelist()
# 三档触发词互不串
d = p.read(PP + 'prompts/default.txt').decode()
r = p.read(PP + 'prompts/regular.txt').decode()
c = p.read(PP + 'prompts/claude.txt').decode()
assert '「默认」' in d and '「朝花」' not in d and '「专用」' not in d
assert '「朝花」' in r and '「默认」' not in r and '「专用」' not in r
assert '「专用」' in c and '「默认」' not in c and '朝花' not in c
print('trigger words isolated OK')
host = p.read(PP + 'lib/index.js').decode()
assert 'default.txt' in host and 'readPrompt' in host
# lite9 regressions
yml = p.read('dshhome/cordis.patch.yml').decode()
assert yml.count("'{{zhaohua_prompt}}'") == 4
assert 'dshhome/skills/sec-toolkit/SKILL.md' in p.namelist()
assert 'bin/proot' in p.namelist()
v18z = zipfile.ZipFile('out/DeepSeekHarness-ZhaoHua-v18-unsigned.apk')
assert z.read('classes.dex') == v18z.read('classes.dex')
print('ALL PASS | md5:', hashlib.md5(data).hexdigest(), '| size:', len(data))
