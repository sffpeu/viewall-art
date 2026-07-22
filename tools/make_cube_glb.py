#!/usr/bin/env python3
"""Generate an animated (spinning) colored cube as a valid .glb — no dependencies."""
import struct, json, math, os

# --- Geometry: a unit cube (24 verts so each face has flat normals) ----------
# 6 faces * 4 verts. positions, normals per face.
faces = [
    ((0,0,1),  [(-.5,-.5,.5),(.5,-.5,.5),(.5,.5,.5),(-.5,.5,.5)]),
    ((0,0,-1), [(.5,-.5,-.5),(-.5,-.5,-.5),(-.5,.5,-.5),(.5,.5,-.5)]),
    ((1,0,0),  [(.5,-.5,.5),(.5,-.5,-.5),(.5,.5,-.5),(.5,.5,.5)]),
    ((-1,0,0), [(-.5,-.5,-.5),(-.5,-.5,.5),(-.5,.5,.5),(-.5,.5,-.5)]),
    ((0,1,0),  [(-.5,.5,.5),(.5,.5,.5),(.5,.5,-.5),(-.5,.5,-.5)]),
    ((0,-1,0), [(-.5,-.5,-.5),(.5,-.5,-.5),(.5,-.5,.5),(-.5,-.5,.5)]),
]
positions, normals, indices = [], [], []
for i,(n,verts) in enumerate(faces):
    for v in verts:
        positions.append(v); normals.append(n)
    o = i*4
    indices += [o,o+1,o+2, o,o+2,o+3]

# --- Animation: rotation about Y, full turn over 2s (quaternion keyframes) ----
times = [0.0, 0.5, 1.0, 1.5, 2.0]
def quat_y(a): return (0.0, math.sin(a/2), 0.0, math.cos(a/2))
rots = [quat_y(t/2.0 * 2*math.pi) for t in times]

# --- Pack binary buffer -------------------------------------------------------
def pack_f(seq_of_tuples):
    b = b''.join(struct.pack('<%df'%len(t), *t) for t in seq_of_tuples)
    return b
def pad4(b): return b + b'\x00'*((4-len(b)%4)%4)

pos_b  = pack_f(positions)
nrm_b  = pack_f(normals)
idx_b  = struct.pack('<%dH'%len(indices), *indices)
time_b = struct.pack('<%df'%len(times), *times)
rot_b  = pack_f(rots)

chunks = [pos_b, nrm_b, idx_b, time_b, rot_b]
offsets, cur = [], 0
buf = b''
for c in chunks:
    c = pad4(c)
    offsets.append((cur, len(c)))
    buf += c; cur += len(c)

def mm(seq, comps):
    cols = list(zip(*seq)) if comps>1 else [seq]
    return [min(c) for c in cols], [max(c) for c in cols]
pos_min, pos_max = mm(positions,3)

gltf = {
 "asset":{"version":"2.0","generator":"make_cube_glb"},
 "scene":0,"scenes":[{"nodes":[0]}],
 "nodes":[{"mesh":0,"name":"SpinCube","rotation":[0,0,0,1]}],
 "meshes":[{"primitives":[{"attributes":{"POSITION":0,"NORMAL":1},"indices":2,"material":0}]}],
 "materials":[{"name":"CubeMat","pbrMetallicRoughness":{
     "baseColorFactor":[0.31,0.82,0.77,1.0],"metallicFactor":0.1,"roughnessFactor":0.5},
     "emissiveFactor":[0.09,0.25,0.23]}],
 "animations":[{"name":"Spin",
   "samplers":[{"input":3,"output":4,"interpolation":"LINEAR"}],
   "channels":[{"sampler":0,"target":{"node":0,"path":"rotation"}}]}],
 "buffers":[{"byteLength":len(buf)}],
 "bufferViews":[
   {"buffer":0,"byteOffset":offsets[0][0],"byteLength":len(pos_b),"target":34962},
   {"buffer":0,"byteOffset":offsets[1][0],"byteLength":len(nrm_b),"target":34962},
   {"buffer":0,"byteOffset":offsets[2][0],"byteLength":len(idx_b),"target":34963},
   {"buffer":0,"byteOffset":offsets[3][0],"byteLength":len(time_b)},
   {"buffer":0,"byteOffset":offsets[4][0],"byteLength":len(rot_b)},
 ],
 "accessors":[
   {"bufferView":0,"componentType":5126,"count":len(positions),"type":"VEC3","min":pos_min,"max":pos_max},
   {"bufferView":1,"componentType":5126,"count":len(normals),"type":"VEC3"},
   {"bufferView":2,"componentType":5123,"count":len(indices),"type":"SCALAR"},
   {"bufferView":3,"componentType":5126,"count":len(times),"type":"SCALAR","min":[times[0]],"max":[times[-1]]},
   {"bufferView":4,"componentType":5126,"count":len(rots),"type":"VEC4"},
 ],
}

# JSON chunk must be padded with spaces (0x20) per glTF spec, not null bytes.
_jb = json.dumps(gltf).encode('utf-8')
json_b = _jb + b' '*((4-len(_jb)%4)%4)
bin_b  = pad4(buf)
glb = struct.pack('<III', 0x46546C67, 2, 12 + 8+len(json_b) + 8+len(bin_b))
glb += struct.pack('<II', len(json_b), 0x4E4F534A) + json_b
glb += struct.pack('<II', len(bin_b), 0x004E4942) + bin_b

out = os.path.expanduser("~/Desktop/ar-book/public/assets/model.glb")
with open(out,'wb') as f: f.write(glb)
print("wrote", out, len(glb), "bytes")
