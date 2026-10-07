// Offline texture baking: decode and assemble the original Blender scene once.
import { loadThree, webglOK, reduced, coarse, saveData } from '/superdev/assets/gfx.js';

const NO_OUTLINE = new Set(['ring', 'starGlow']);
const MERGED = new Set(['rock', 'star']);

async function loadBin() {
  if ('DecompressionStream' in window) {
    try {
      const r = await fetch('assets/3d/bg.bin.gz');
      if (r.ok) return await new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
    } catch { /* ใช้ไฟล์ไม่บีบอัดแทน */ }
  }
  return fetch('assets/3d/bg.bin').then((r) => r.arrayBuffer());
}

export async function initBg3d() {
  if (saveData || !webglOK()) return;
  let T, meta, bin;
  try {
    if (location.protocol === 'file:') {
      // เปิดจากไฟล์ในเครื่อง: fetch ใช้ไม่ได้ จึงโหลดข้อมูลที่ฝังไว้ในสคริปต์แทน
      await new Promise((ok, no) => { const sc = document.createElement('script'); sc.src = 'assets/3d/bg-data.js'; sc.onload = ok; sc.onerror = no; document.head.append(sc); });
      const d = window.__BG3D; meta = d.meta;
      const raw = Uint8Array.from(atob(d.gz), (ch) => ch.charCodeAt(0));
      bin = await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
      T = await loadThree();
    } else {
      [T, meta, bin] = await Promise.all([loadThree(), fetch('assets/3d/bg.json').then((r) => r.json()), loadBin()]);
    }
  } catch {
    return;
  }

  const canvas = document.createElement('canvas');
  canvas.className = 'bg3d';
  canvas.setAttribute('aria-hidden', 'true');
  (document.querySelector('.starfield') || document.body.firstElementChild).after(canvas);

  let renderer;
  try {
    renderer = new T.WebGLRenderer({ canvas, alpha: true, antialias: true, stencil: false, powerPreference: coarse ? 'low-power' : 'default' });
  } catch {
    canvas.remove();
    return;
  }
  renderer.outputColorSpace = T.SRGBColorSpace;
  if (location.search.includes('perf')) window.__bg3d = renderer; // ?perf ดูจำนวน draw call ได้

  const scene = new T.Scene();
  scene.fog = new T.Fog(0x0c0632, 17, 46);
  const camera = new T.PerspectiveCamera(40, 1, 0.5, 120);
  scene.add(new T.HemisphereLight(0xc9b8ff, 0x1a0d4a, 1.6));
  const key = new T.DirectionalLight(0xffffff, 2.4);
  key.position.set(6, 9, 12);
  const rim = new T.DirectionalLight(0x6fe6ff, 1.6);
  rim.position.set(-9, -3, -6);
  scene.add(key, rim);

  // ── วัสดุ: toon 3 ระดับ ใช้สีต่อจุด + แสงเรืองต่อจุด (วัสดุเดียวทั้งฉาก) ──
  const ramp = new T.DataTexture(new Uint8Array([90, 170, 255]), 3, 1, T.RedFormat);
  ramp.minFilter = ramp.magFilter = T.NearestFilter;
  ramp.needsUpdate = true;
  // Apply the muted background colors in the existing draw, without a full-screen CSS filter.
  const mutedColor = 'mix(vec3(dot(gl_FragColor.rgb, vec3(0.2126, 0.7152, 0.0722))), gl_FragColor.rgb, 0.5) * 0.85';
  const mute = sh => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <colorspace_fragment>', `#include <colorspace_fragment>\ngl_FragColor.rgb = ${mutedColor};`);
  };
  const toon = new T.MeshToonMaterial({ vertexColors: true, gradientMap: ramp });
  toon.onBeforeCompile = (sh) => {
    sh.vertexShader = 'attribute float emi;\nvarying float vEmi;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvEmi = emi;');
    sh.fragmentShader = 'varying float vEmi;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', 'totalEmissiveRadiance = vColor.rgb * vEmi;');
    mute(sh);
  };
  const outlineMat = new T.MeshBasicMaterial({ color: 0x150a36, side: T.BackSide });
  outlineMat.onBeforeCompile = (sh) => {
    sh.vertexShader = 'attribute vec3 hn;\n' + sh.vertexShader.replace('#include <begin_vertex>', 'vec3 transformed = position + hn * 0.04;');
    mute(sh);
  };
  const portalMat = new T.ShaderMaterial({
    uniforms: { t: { value: 0 } },
    vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `precision mediump float; uniform float t; varying vec2 vP;
      void main(){
        vec2 p = (vP - vec2(0.0, 0.15)) / vec2(1.25, 0.95);
        float r = length(p), a = atan(p.y, p.x);
        float s = sin(a * 3.0 + r * 11.0 - t * 3.2);
        vec3 c = mix(vec3(0.10, 0.04, 0.36), vec3(0.62, 0.36, 1.0), 0.5 + 0.5 * s);
        c = mix(c, vec3(0.5, 0.95, 1.0), smoothstep(0.45, 0.0, r) * (0.7 + 0.3 * sin(t * 2.0)));
        c *= smoothstep(1.35, 0.55, r) + 0.2;
        gl_FragColor = vec4(c, 1.0);
        gl_FragColor.rgb = ${mutedColor};
      }`,
  });

  // ── ถอดรหัสเมชบีบอัดจาก Blender (ทำครั้งเดียว) ──
  const decode = (p) => {
    const n = p.n, q = new Uint16Array(bin, p.po, n * 3), nn = new Int8Array(bin, p.no, n * 3);
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), hn = new Float32Array(n * 3);
    for (let i = 0; i < n * 3; i++) {
      const a = i % 3;
      pos[i] = p.lo[a] + (q[i] / 65535) * (p.hi[a] - p.lo[a]);
      nor[i] = nn[i] / 127;
    }
    if (!NO_OUTLINE.has(p.mat)) {
      // เส้นขอบการ์ตูน: เฉลี่ยนอร์มอลของจุดที่ซ้อนกัน เพื่อไม่ให้ขอบแตกตรงมุมคม (ไม่มีเส้นขอบ → hn = 0)
      const acc = new Map(), keyOf = (v) => q[v * 3] * 4294967296 + q[v * 3 + 1] * 65536 + q[v * 3 + 2];
      const sum = new Float32Array(n * 3);
      for (let v = 0; v < n; v++) {
        const k = keyOf(v);
        let s = acc.get(k);
        if (s === undefined) { s = v * 3; acc.set(k, s); }
        sum[s] += nor[v * 3]; sum[s + 1] += nor[v * 3 + 1]; sum[s + 2] += nor[v * 3 + 2];
      }
      for (let v = 0; v < n; v++) {
        const s = acc.get(keyOf(v));
        const l = Math.hypot(sum[s], sum[s + 1], sum[s + 2]) || 1;
        hn[v * 3] = sum[s] / l; hn[v * 3 + 1] = sum[s + 1] / l; hn[v * 3 + 2] = sum[s + 2] / l;
      }
    }
    const m = meta.materials[p.mat];
    return { n, pos, nor, hn, idx: new Uint16Array(bin, p.io, p.i), col: new T.Color(m.color), emi: (m.e || 0) * 0.85, portal: p.mat === 'portal' };
  };

  // รวมหลายชิ้นเป็นเมชเดียว (ใส่ matrix เพื่อย้ายชิ้นเข้าพิกัดเดียวกันได้)
  const v3 = new T.Vector3(), nm = new T.Matrix3();
  const merge = (list) => {
    let nv = 0, ni = 0;
    for (const { d } of list) { nv += d.n; ni += d.idx.length; }
    const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), hn = new Float32Array(nv * 3);
    const col = new Float32Array(nv * 3), emi = new Float32Array(nv);
    const idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
    let vo = 0, io = 0;
    for (const { d, m } of list) {
      if (m) {
        nm.getNormalMatrix(m);
        for (let v = 0; v < d.n; v++) {
          const o = (vo + v) * 3, s = v * 3;
          v3.fromArray(d.pos, s).applyMatrix4(m).toArray(pos, o);
          v3.fromArray(d.nor, s).applyMatrix3(nm).normalize().toArray(nor, o);
          v3.fromArray(d.hn, s).applyMatrix3(nm).toArray(hn, o);
        }
      } else {
        pos.set(d.pos, vo * 3); nor.set(d.nor, vo * 3); hn.set(d.hn, vo * 3);
      }
      for (let v = 0; v < d.n; v++) {
        const o = (vo + v) * 3;
        col[o] = d.col.r; col[o + 1] = d.col.g; col[o + 2] = d.col.b;
        emi[vo + v] = d.emi;
      }
      for (let i = 0; i < d.idx.length; i++) idx[io + i] = d.idx[i] + vo;
      vo += d.n; io += d.idx.length;
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(pos, 3));
    g.setAttribute('normal', new T.BufferAttribute(nor, 3));
    g.setAttribute('hn', new T.BufferAttribute(hn, 3));
    g.setAttribute('color', new T.BufferAttribute(col, 3));
    g.setAttribute('emi', new T.BufferAttribute(emi, 1));
    g.setIndex(new T.BufferAttribute(idx, 1));
    g.computeBoundingSphere();
    return g;
  };
  const withOutline = (parent, g) => {
    parent.add(new T.Mesh(g, toon));
    parent.add(new T.Mesh(g, outlineMat));
  };
  const build = (grp) => {
    const inner = new T.Group();
    const ds = grp.parts.map(decode);
    const solid = ds.filter((d) => !d.portal);
    if (solid.length) withOutline(inner, merge(solid.map((d) => ({ d }))));
    for (const d of ds.filter((x) => x.portal)) {
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.BufferAttribute(d.pos, 3));
      g.setIndex(new T.BufferAttribute(d.idx.slice(), 1));
      inner.add(new T.Mesh(g, portalMat));
    }
    return inner;
  };

  // ── วางวัตถุตามตำแหน่งที่จัดไว้ใน Blender ──
  const items = [], loose = [];
  for (const grp of meta.groups) {
    if (grp.kind === 'train-loco' || grp.kind === 'train-car') continue;
    if (MERGED.has(grp.kind)) { loose.push({ m: new T.Matrix4().fromArray(grp.m), ds: grp.parts.map(decode) }); continue; }
    const outer = new T.Group();
    new T.Matrix4().fromArray(grp.m).decompose(outer.position, outer.quaternion, outer.scale);
    outer.add(build(grp));
    scene.add(outer);
    items.push({ outer, inner: outer.children[0], kind: grp.kind, spin: grp.spin, bob: grp.bob, ph: items.length * 1.7, x0: outer.position.x, y0: outer.position.y });
  }
  bin = null;

  // หินและดาวทั้งหมด → เมชเดียว (สร้างใหม่เฉพาะตอนสัดส่วนจอเปลี่ยนมาก)
  let kx = 1;
  const debris = new T.Group();
  scene.add(debris);
  const makeDebris = () => {
    for (const c of debris.children) c.geometry.dispose();
    debris.clear();
    const list = [];
    for (const it of loose) {
      const m = it.m.clone();
      m.elements[12] *= kx;
      for (const d of it.ds) list.push({ d, m });
    }
    withOutline(debris, merge(list));
  };

  makeDebris();
  return { T, renderer, scene, meta };
}
