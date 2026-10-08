/* ==========================================================================
   Isabela Palhano — portfólio / showreel
   Cena 3D (Three.js) + coreografia de scroll (GSAP ScrollTrigger + Lenis)
   ========================================================================== */

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildLabels, printSheet, COLLECTION, PRODUCTS } from './labels.js';

const { gsap, ScrollTrigger } = window;
gsap.registerPlugin(ScrollTrigger);
ScrollTrigger.config({ ignoreMobileResize: true });

/* ---------- utilitários ---------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, v) => {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const TAU = Math.PI * 2;
const hexToRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mixRgb = (a, b, t) => a.map((v, i) => Math.round(lerp(v, b[i], t)));

const isMobile = () => innerWidth < 820;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;

const SKETCH = COLLECTION.length; // índice do rótulo-rascunho
const YOURS = COLLECTION.length + 1; // índice do rótulo "sua marca aqui"
const N = COLLECTION.length;
const M = PRODUCTS.length;

/* ---------- estado ---------- */
let lenis = null;
let gl = null; // tudo que é WebGL
const ST = {}; // ScrollTriggers usados como âncoras
const dom = {};
let poseKeys = [];
let colorKeys = [];
const state = {
  time: 0,
  intro: 0,
  auto: 0,
  autoVel: 0,
  open: 0,
  burst: 0,
  rise: 0,
  pointer: { x: 0, y: 0, sx: 0, sy: 0 },
  cur: null,
  velocity: 0,
};

/* ==========================================================================
   LOADER
   ========================================================================== */
const loader = {
  el: $('#loader'),
  value: 0,
  shown: 0,
  set(v) {
    this.value = Math.max(this.value, v);
  },
};
gsap.ticker.add(() => {
  if (!loader.el) return;
  loader.shown += (loader.value - loader.shown) * 0.12;
  const v = Math.round(loader.shown);
  $('.loader-pct', loader.el).textContent = String(v).padStart(2, '0');
  $('.loader-can i', loader.el).style.height = `${loader.shown}%`;
});

async function loadFonts() {
  const specs = [
    '400 100px "Anton"', '400 100px "Lobster"', '400 100px "Bungee"', '400 100px "Instrument Serif"',
    'italic 400 100px "Instrument Serif"', '400 100px "DM Sans"', '700 100px "DM Sans"',
    '500 100px "Caveat"', '700 100px "Caveat"',
  ];
  const all = Promise.all(specs.map((s) => document.fonts.load(s, 'AÁÃÇÉÊÍÓÔÚaáãçéêíóôú0123')));
  await Promise.race([all, new Promise((r) => setTimeout(r, 6000))]);
}

/* ==========================================================================
   DOM gerado a partir dos dados
   ========================================================================== */
function buildDom(L) {
  // itens do showreel
  const reelInfo = $('.reel-info');
  reelInfo.innerHTML = L.designs
    .map(
      (d, i) => `
    <article class="reel-item" data-i="${i}" aria-hidden="${i ? 'true' : 'false'}">
      <p class="reel-num">${String(i + 1).padStart(2, '0')} — ${d.flavor}</p>
      <h3 class="reel-name">${d.name}</h3>
      <p class="reel-desc">${d.desc}</p>
      <ul class="tags">${d.tags.map((t) => `<li>${t}</li>`).join('')}</ul>
      <div class="swatches" aria-label="Paleta">${d.palette.map((c) => `<span style="--c:${c}" title="${c}"></span>`).join('')}</div>
      <img class="reel-thumb" alt="Rótulo planificado ${d.name}" src="${d.canvas.toDataURL('image/jpeg', 0.82)}">
    </article>`
    )
    .join('');
  $('.reel-total').textContent = String(N).padStart(2, '0');

  // pranchas de arte-final
  const track = $('.gallery-track');
  const cta = $('.sheet-cta', track);
  L.designs.forEach((d, i) => {
    const art = document.createElement('article');
    art.className = 'sheet';
    art.style.setProperty('--glow', d.glow);
    art.innerHTML = `
      <div class="sheet-frame" data-cursor="Arte-final">
        <div class="sheet-inner"><i class="sheet-glare"></i></div>
      </div>
      <div class="sheet-meta">
        <span class="sheet-n">${String(i + 1).padStart(2, '0')}</span>
        <span class="sheet-name">${d.name} <em>${d.flavor}</em></span>
        <span class="sheet-file">${d.file}</span>
      </div>`;
    const cv = printSheet(d);
    cv.setAttribute('role', 'img');
    cv.setAttribute('aria-label', `Arte-final planificada do rótulo ${d.name} — ${d.flavor}`);
    $('.sheet-inner', art).prepend(cv);
    track.insertBefore(art, cta);
  });

  // embalagens
  $('.products-info').innerHTML = PRODUCTS.map(
    (p, i) => `
    <article class="product-item" data-i="${i}">
      <p class="reel-num">${String(i + 1).padStart(2, '0')} — ${p.kind}</p>
      <h3 class="product-name">${p.name}</h3>
      <p class="reel-desc">${p.desc}</p>
      <ul class="tags">${p.tags.map((t) => `<li>${t}</li>`).join('')}</ul>
    </article>`
  ).join('');
  $('.products-total').textContent = String(M).padStart(2, '0');
  dom.reelItems = $$('.reel-item');
  dom.prodItems = $$('.product-item');
}

/* ==========================================================================
   WEBGL
   ========================================================================== */
const TOP_PTS = [
  [1.0, 1.42], [0.998, 1.48], [0.985, 1.54], [0.955, 1.61], [0.915, 1.68], [0.88, 1.735], [0.862, 1.77],
  [0.858, 1.8], [0.862, 1.825], [0.868, 1.845], [0.862, 1.862], [0.845, 1.866], [0.832, 1.855], [0.826, 1.83],
  [0.82, 1.79], [0.8, 1.772], [0.6, 1.768], [0.0, 1.768],
];
const BOT_PTS = [
  [0.0, -1.64], [0.3, -1.655], [0.55, -1.7], [0.68, -1.77], [0.74, -1.83], [0.78, -1.855], [0.82, -1.852],
  [0.87, -1.83], [0.93, -1.76], [0.975, -1.67], [0.995, -1.6], [1.0, -1.55],
];
const v2 = (pts) => pts.map(([x, y]) => new THREE.Vector2(x, y));

function roundedRect(shape, x, y, w, h, r) {
  shape.moveTo(x + r, y);
  shape.lineTo(x + w - r, y);
  shape.quadraticCurveTo(x + w, y, x + w, y + r);
  shape.lineTo(x + w, y + h - r);
  shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  shape.lineTo(x + r, y + h);
  shape.quadraticCurveTo(x, y + h, x, y + h - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);
}

function initGL(L) {
  const canvas = $('#webgl');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, isMobile() ? 1.75 : 2));
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, innerWidth / innerHeight, 0.1, 100);
  camera.position.set(0, 0, 11);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();

  const key = new THREE.DirectionalLight(0xffffff, 2.0);
  key.position.set(4, 6, 8);
  const rim = new THREE.DirectionalLight(0xff3040, 5);
  rim.position.set(-6, 3, -5);
  const rim2 = new THREE.DirectionalLight(0xffffff, 1.4);
  rim2.position.set(7, -2, -4);
  scene.add(key, rim, rim2);

  const aniso = renderer.capabilities.getMaxAnisotropy();
  const tex = (cv, srgb = true) => {
    const t = new THREE.CanvasTexture(cv);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = aniso;
    t.wrapS = THREE.RepeatWrapping;
    return t;
  };
  const labels = [...L.designs, L.sketch, L.yours].map((d) => ({ map: tex(d.canvas), orm: tex(d.orm, false) }));

  /* ----- lata ----- */
  const canRig = new THREE.Group();
  const canSpin = new THREE.Group();
  canRig.add(canSpin);
  scene.add(canRig);

  const U = {
    uMapB: { value: labels[1].map },
    uOrmA: { value: labels[0].orm },
    uOrmB: { value: labels[1].orm },
    uMix: { value: 0 },
    uTime: { value: 0 },
  };
  const labelMat = new THREE.MeshPhysicalMaterial({
    map: labels[0].map,
    roughness: 1,
    metalness: 1,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    envMapIntensity: 1.25,
  });
  // transição "líquida" entre dois rótulos: o novo sobe como refrigerante enchendo a lata
  labelMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform sampler2D uMapB; uniform sampler2D uOrmA; uniform sampler2D uOrmB;
        uniform float uMix; uniform float uTime;`
      )
      .replace(
        '#include <map_fragment>',
        `float lvl = uMix * 1.24 - 0.12
          + sin(vMapUv.x * 37.699 + uTime * 2.4) * 0.018
          + sin(vMapUv.x * 12.566 - uTime * 1.3) * 0.022;
        float labelMix = smoothstep(lvl - 0.006, lvl + 0.006, vMapUv.y);
        vec4 sampledDiffuseColor = mix(texture2D(uMapB, vMapUv), texture2D(map, vMapUv), labelMix);
        diffuseColor *= sampledDiffuseColor;
        float foam = 1.0 - smoothstep(0.0, 0.014, abs(vMapUv.y - lvl));
        diffuseColor.rgb += foam * 0.85;`
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `vec4 ormS = mix(texture2D(uOrmB, vMapUv), texture2D(uOrmA, vMapUv), labelMix);
        float roughnessFactor = roughness * max(ormS.g, 0.04);`
      )
      .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = metalness * ormS.b;');
  };

  const body = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 2.97, 160, 1, true, Math.PI), labelMat);
  body.position.y = (1.42 - 1.55) / 2;
  const metal = new THREE.MeshPhysicalMaterial({
    color: 0xe3e6ea, metalness: 1, roughness: 0.24, clearcoat: 0.4, clearcoatRoughness: 0.2,
    side: THREE.DoubleSide, envMapIntensity: 1.25,
  });
  const top = new THREE.Mesh(new THREE.LatheGeometry(v2(TOP_PTS), 160), metal);
  const bot = new THREE.Mesh(new THREE.LatheGeometry(v2(BOT_PTS), 160), metal);
  canSpin.add(body, top, bot);

  // boca (marca do lacre) e anel
  const mouthShape = new THREE.Shape();
  mouthShape.moveTo(-0.2, 0.18);
  mouthShape.quadraticCurveTo(0, 0.12, 0.2, 0.18);
  mouthShape.quadraticCurveTo(0.27, 0.42, 0, 0.55);
  mouthShape.quadraticCurveTo(-0.27, 0.42, -0.2, 0.18);
  const mouth = new THREE.Mesh(
    new THREE.ShapeGeometry(mouthShape, 16).rotateX(-Math.PI / 2),
    new THREE.MeshPhysicalMaterial({ color: 0xa9adb3, metalness: 1, roughness: 0.38, envMapIntensity: 1.2 })
  );
  mouth.position.y = 1.7695;
  mouth.rotation.y = Math.PI; // a boca fica para a frente (+z)
  canSpin.add(mouth);

  const tabMat = new THREE.MeshPhysicalMaterial({ color: 0xd5d9de, metalness: 1, roughness: 0.2, clearcoat: 0.5, envMapIntensity: 1.3 });
  const tabShape = new THREE.Shape();
  roundedRect(tabShape, -0.17, -0.24, 0.34, 0.64, 0.15);
  const hole = new THREE.Path();
  roundedRect(hole, -0.11, 0.06, 0.22, 0.24, 0.1);
  tabShape.holes.push(hole);
  const tabGeo = new THREE.ExtrudeGeometry(tabShape, {
    depth: 0.018, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 2, curveSegments: 12,
  });
  tabGeo.rotateX(-Math.PI / 2);
  const tabPivot = new THREE.Group();
  tabPivot.position.set(0, 1.772, 0.05);
  tabPivot.add(new THREE.Mesh(tabGeo, tabMat));
  const rivet = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.03, 24), tabMat);
  rivet.position.set(0, 1.785, 0.05);
  canSpin.add(tabPivot, rivet);

  /* ----- bolhas (gás) ----- */
  const BN = isMobile() ? 160 : 300;
  const bGeo = new THREE.BufferGeometry();
  const pos = new Float32Array(BN * 3);
  const size = new Float32Array(BN);
  const speed = new Float32Array(BN);
  const phase = new Float32Array(BN);
  for (let i = 0; i < BN; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 16;
    pos[i * 3 + 1] = (Math.random() - 0.5) * 11;
    pos[i * 3 + 2] = -5 + Math.random() * 7;
    size[i] = 0.05 + Math.pow(Math.random(), 3) * 0.22;
    speed[i] = 0.4 + Math.random() * 0.9;
    phase[i] = Math.random() * TAU;
  }
  bGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  bGeo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  bGeo.setAttribute('aSpeed', new THREE.BufferAttribute(speed, 1));
  bGeo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  const bMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uRise: { value: 0 },
      uScale: { value: innerHeight },
      uOpacity: { value: 1 },
      uColor: { value: new THREE.Color(0xffffff) },
    },
    vertexShader: `
      uniform float uTime; uniform float uRise; uniform float uScale;
      attribute float aSize; attribute float aSpeed; attribute float aPhase;
      varying float vAlpha;
      void main() {
        vec3 p = position;
        p.y = mod(p.y + 5.5 + uRise * aSpeed, 11.0) - 5.5;
        p.x += sin(uTime * 1.3 + aPhase + p.y) * 0.12;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = aSize * uScale / -mv.z;
        gl_Position = projectionMatrix * mv;
        vAlpha = smoothstep(-5.5, -3.5, p.y) * (1.0 - smoothstep(3.5, 5.5, p.y));
      }`,
    fragmentShader: `
      uniform vec3 uColor; uniform float uOpacity;
      varying float vAlpha;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float d = length(c);
        if (d > 0.5) discard;
        float ring = smoothstep(0.5, 0.44, d) * smoothstep(0.28, 0.46, d);
        float fill = (1.0 - smoothstep(0.0, 0.5, d)) * 0.1;
        float spec = 1.0 - smoothstep(0.0, 0.13, length(c - vec2(-0.16, -0.16)));
        float a = (ring * 0.75 + fill + spec * 0.9) * vAlpha * uOpacity;
        gl_FragColor = vec4(uColor, a);
      }`,
  });
  const bubbles = new THREE.Points(bGeo, bMat);
  bubbles.frustumCulled = false;
  scene.add(bubbles);

  /* ----- embalagens ----- */
  const prodRig = new THREE.Group();
  scene.add(prodRig);
  const items = [];
  const P = L.products;

  // garrafa âmbar — Brota kombucha
  {
    const g = new THREE.Group();
    const glassPts = [
      [0.0, -1.62], [0.55, -1.62], [0.7, -1.6], [0.76, -1.52], [0.77, -1.3], [0.77, 0.3], [0.755, 0.5], [0.69, 0.72],
      [0.56, 0.95], [0.42, 1.18], [0.335, 1.4], [0.31, 1.6], [0.305, 1.95], [0.33, 1.99], [0.345, 2.04], [0.33, 2.1], [0.3, 2.12],
    ];
    const liquidPts = [[0.0, -1.55], [0.7, -1.55], [0.73, -1.3], [0.73, 0.3], [0.72, 0.5], [0.66, 0.7], [0.53, 0.93], [0.42, 1.12], [0.0, 1.12]];
    const liquid = new THREE.Mesh(
      new THREE.LatheGeometry(v2(liquidPts), 64),
      new THREE.MeshPhysicalMaterial({ color: 0x3b1606, roughness: 0.25, metalness: 0, emissive: 0x1a0702 })
    );
    const glass = new THREE.Mesh(
      new THREE.LatheGeometry(v2(glassPts), 96),
      new THREE.MeshPhysicalMaterial({
        color: 0x4a2208, roughness: 0.05, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02,
        transparent: true, opacity: 0.55, envMapIntensity: 2.4, depthWrite: false, side: THREE.DoubleSide,
      })
    );
    glass.renderOrder = 2;
    const label = new THREE.Mesh(
      new THREE.CylinderGeometry(0.778, 0.778, 1.35, 96, 1, true, Math.PI),
      new THREE.MeshPhysicalMaterial({ map: tex(P.brota), roughness: 0.82, metalness: 0, sheen: 0.3 })
    );
    label.position.y = -0.55;
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.36, 0.16, 28),
      new THREE.MeshPhysicalMaterial({ color: 0x1f4d2b, metalness: 0.9, roughness: 0.3, clearcoat: 1 })
    );
    cap.position.y = 2.16;
    g.add(liquid, label, glass, cap);
    g.position.y = -0.3;
    items.push({ group: g, scale: 0.9, tilt: [0.05, 0, -0.08] });
  }

  // pote de vidro — Mel de Aroeira
  {
    const g = new THREE.Group();
    const jarPts = [[0, -1], [0.82, -1], [0.92, -0.96], [0.95, -0.85], [0.95, 0.62], [0.93, 0.72], [0.86, 0.78], [0.84, 0.82], [0.84, 0.98]];
    const honeyPts = [[0, -0.96], [0.84, -0.96], [0.915, -0.85], [0.915, 0.55], [0.0, 0.55]];
    const honey = new THREE.Mesh(
      new THREE.LatheGeometry(v2(honeyPts), 64),
      new THREE.MeshPhysicalMaterial({ color: 0xf0a21a, roughness: 0.15, clearcoat: 1, emissive: 0x6b3a00, emissiveIntensity: 0.45 })
    );
    const glass = new THREE.Mesh(
      new THREE.LatheGeometry(v2(jarPts), 96),
      new THREE.MeshPhysicalMaterial({
        color: 0xffffff, roughness: 0.03, clearcoat: 1, transparent: true, opacity: 0.2, envMapIntensity: 2.6,
        depthWrite: false, side: THREE.DoubleSide,
      })
    );
    glass.renderOrder = 2;
    const label = new THREE.Mesh(
      new THREE.CylinderGeometry(0.962, 0.962, 0.98, 96, 1, true, Math.PI),
      new THREE.MeshPhysicalMaterial({ map: tex(P.mel), roughness: 0.4, clearcoat: 0.6 })
    );
    label.position.y = -0.13;
    const lidSide = new THREE.MeshPhysicalMaterial({ color: 0x173a2a, metalness: 0.85, roughness: 0.28, clearcoat: 1 });
    const lidTopTex = tex(P.melLid);
    lidTopTex.wrapS = THREE.ClampToEdgeWrapping;
    const lidTop = new THREE.MeshPhysicalMaterial({ map: lidTopTex, metalness: 0.5, roughness: 0.3, clearcoat: 1 });
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.89, 0.89, 0.34, 96), [lidSide, lidTop, lidSide]);
    lid.position.y = 1.14;
    g.add(honey, label, glass, lid);
    g.position.y = -0.15;
    items.push({ group: g, scale: 1.2, tilt: [0.32, 0, 0.06] });
  }

  // cartucho — Cacau Cariri
  {
    const g = new THREE.Group();
    const side = new THREE.MeshPhysicalMaterial({ color: 0x3a170c, roughness: 0.45, clearcoat: 0.6 });
    const front = new THREE.MeshPhysicalMaterial({ map: tex(P.cacauFront), roughness: 0.45, clearcoat: 0.7, clearcoatRoughness: 0.2 });
    const back = new THREE.MeshPhysicalMaterial({ map: tex(P.cacauBack), roughness: 0.45, clearcoat: 0.7, clearcoatRoughness: 0.2 });
    const box = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.4, 0.26), [side, side, side, side, front, back]);
    g.add(box);
    items.push({ group: g, scale: 1.15, tilt: [0.18, 0, -0.22], sway: true });
  }
  items.forEach((it) => {
    const spin = new THREE.Group();
    const rig = new THREE.Group();
    spin.add(it.group);
    rig.add(spin);
    prodRig.add(rig);
    it.rig = rig;
    it.spin = spin;
  });

  // pré-compila shaders
  renderer.compile(scene, camera);

  return { renderer, scene, camera, canRig, canSpin, tabPivot, labelMat, labels, U, bubbles, bMat, prodRig, items, rim };
}

/* ==========================================================================
   SCROLL — âncoras, poses e cores
   ========================================================================== */
const P = (o) => ({ x: 0, y: 0, s: 1, rx: 0, rz: 0, auto: 0, ...o });

function poses() {
  const m = isMobile();
  return {
    hero: m ? P({ x: 0, y: 0.28, s: 0.66, rx: 0.1, rz: -0.12, auto: 1 }) : P({ x: 0.36, y: -0.04, s: 1.02, rx: 0.1, rz: -0.2, auto: 1 }),
    mani: m ? P({ x: 0.15, y: 1.9, s: 0.62, rx: 0.2, rz: 0.5, auto: 0.5 }) : P({ x: -0.52, y: -0.02, s: 0.94, rx: 0.15, rz: 0.28, auto: 0.5 }),
    reel: m ? P({ x: 0, y: 0.3, s: 0.6, rx: 0.06, rz: -0.06 }) : P({ x: 0.33, y: -0.02, s: 1.0, rx: 0.06, rz: -0.1 }),
    proc: m ? P({ x: 0.52, y: 0.6, s: 0.42, rx: 0.1, rz: -0.18, auto: 0.15 }) : P({ x: 0.44, y: -0.02, s: 0.92, rx: 0.08, rz: -0.12, auto: 0.15 }),
    contact: m ? P({ x: 0, y: 0.42, s: 0.56, rx: 0.12 }) : P({ x: 0.4, y: 0.0, s: 0.98, rx: 0.12, rz: -0.08 }),
    prod: m ? P({ x: 0, y: 0.36, s: 0.62 }) : P({ x: 0.34, y: 0, s: 1 }),
  };
}

function computeKeys() {
  const vh = innerHeight;
  const p = poses();
  const shift = (pose, dy, s) => ({ ...pose, y: pose.y + dy, ...(s === undefined ? {} : { s }) });
  const maniMid = (ST.mani.start + ST.mani.end) / 2;
  poseKeys = [
    { at: 0, pose: p.hero },
    { at: maniMid, pose: p.mani, ease: 'inout' },
    { at: ST.reel.start, pose: p.reel, ease: 'inout' },
    { at: ST.reel.end, pose: p.reel },
    { at: ST.reel.end + vh, pose: shift(p.reel, 2) },
    { at: ST.reel.end + vh + 1, pose: shift(p.reel, 2, 0) },
    { at: ST.proc.start - 1, pose: shift(p.proc, -2, 0) },
    { at: ST.proc.start, pose: shift(p.proc, -2) },
    { at: ST.proc.start + vh, pose: p.proc },
    { at: ST.proc.end - vh, pose: p.proc },
    { at: ST.proc.end, pose: shift(p.proc, 2) },
    { at: ST.proc.end + 1, pose: shift(p.proc, 2, 0) },
    { at: ST.contact.start - 1, pose: shift(p.contact, -2, 0) },
    { at: ST.contact.start, pose: shift(p.contact, -2) },
    { at: ST.contact.start + vh, pose: p.contact },
  ].sort((a, b) => a.at - b.at);

  // cores do fundo
  const D = COLLECTION;
  const seg = (ST.reel.end - ST.reel.start) / (N - 1);
  const pseg = (ST.prod.end - ST.prod.start) / (M - 1);
  const NEUTRAL = { bg: '#0d0c0f', glow: '#3a3440', accent: '#ff4b55' };
  const PROC = { bg: '#0b1018', glow: '#2b5c9e', accent: '#7ab8ff' };
  const CONTACT = { bg: '#200306', glow: '#ff2a36', accent: '#ff4b55' };
  colorKeys = [{ at: 0, bg: D[0].bg, glow: D[0].glow }];
  D.forEach((d, i) => {
    colorKeys.push({ at: ST.reel.start + seg * (i - 0.2), bg: d.bg, glow: d.glow });
    colorKeys.push({ at: ST.reel.start + seg * (i + 0.3), bg: d.bg, glow: d.glow });
  });
  colorKeys.push({ at: ST.reel.end + vh, ...NEUTRAL });
  colorKeys.push({ at: ST.prod.start - vh * 0.6, ...NEUTRAL });
  PRODUCTS.forEach((d, i) => {
    colorKeys.push({ at: ST.prod.start + pseg * (i - 0.2), bg: d.bg, glow: d.glow });
    colorKeys.push({ at: ST.prod.start + pseg * (i + 0.3), bg: d.bg, glow: d.glow });
  });
  colorKeys.push({ at: ST.proc.start + vh * 0.5, ...PROC });
  colorKeys.push({ at: ST.proc.end - vh * 0.5, ...PROC });
  colorKeys.push({ at: ST.serv.start + vh * 0.6, ...NEUTRAL });
  colorKeys.push({ at: ST.contact.start + vh * 0.2, ...NEUTRAL });
  colorKeys.push({ at: ST.contact.start + vh * 0.9, ...CONTACT });
  colorKeys.sort((a, b) => a.at - b.at);
  colorKeys.forEach((k) => {
    k.bgRgb = hexToRgb(k.bg);
    k.glowRgb = hexToRgb(k.glow);
    k.accentRgb = hexToRgb(k.accent || k.glow);
  });
}

function poseAt(s) {
  const k = poseKeys;
  if (s <= k[0].at) return k[0].pose;
  for (let i = 0; i < k.length - 1; i++) {
    const a = k[i];
    const b = k[i + 1];
    if (s >= a.at && s < b.at) {
      let t = (s - a.at) / Math.max(1, b.at - a.at);
      if (b.ease === 'inout') t = easeInOut(t);
      const o = {};
      for (const key in a.pose) o[key] = lerp(a.pose[key], b.pose[key], t);
      return o;
    }
  }
  return k[k.length - 1].pose;
}

function colorAt(s) {
  const k = colorKeys;
  const pick = (a) => ({ bg: a.bgRgb, glow: a.glowRgb, accent: a.accentRgb });
  if (s <= k[0].at) return pick(k[0]);
  for (let i = 0; i < k.length - 1; i++) {
    if (s >= k[i].at && s < k[i + 1].at) {
      const t = smooth(0, 1, (s - k[i].at) / Math.max(1, k[i + 1].at - k[i].at));
      return {
        bg: mixRgb(k[i].bgRgb, k[i + 1].bgRgb, t),
        glow: mixRgb(k[i].glowRgb, k[i + 1].glowRgb, t),
        accent: mixRgb(k[i].accentRgb, k[i + 1].accentRgb, t),
      };
    }
  }
  return pick(k[k.length - 1]);
}

// qual rótulo está na lata (a → b com mistura)
function labelAt(s) {
  const vh = innerHeight;
  if (s < ST.reel.start) return { a: 0, b: 1, mix: 0 };
  if (s <= ST.reel.end) {
    const x = clamp((s - ST.reel.start) / (ST.reel.end - ST.reel.start)) * (N - 1);
    const i = Math.min(Math.floor(x), N - 2);
    const f = x - i;
    return { a: i, b: i + 1, mix: smooth(0.3, 0.8, f), f };
  }
  if (s < ST.reel.end + vh + 2) return { a: N - 1, b: SKETCH, mix: 0 };
  if (s < ST.proc.end) {
    const t0 = ST.proc.start + vh;
    const t = clamp((s - t0) / (ST.proc.end - vh * 1.2 - t0));
    return { a: SKETCH, b: 0, mix: smooth(0.05, 0.95, t) };
  }
  if (s < ST.contact.start) return { a: 0, b: YOURS, mix: 0 };
  return { a: 0, b: YOURS, mix: smooth(ST.contact.start + vh * 0.25, ST.contact.start + vh * 0.95, s) };
}

// posição "efetiva" no showreel (0..N-1)
function reelIndexAt(s) {
  const x = clamp((s - ST.reel.start) / (ST.reel.end - ST.reel.start)) * (N - 1);
  const i = Math.min(Math.floor(x), N - 2);
  return i + smooth(0.3, 0.8, x - i);
}
function prodIndexAt(s) {
  const x = clamp((s - ST.prod.start) / (ST.prod.end - ST.prod.start)) * (M - 1);
  const i = Math.min(Math.floor(x), M - 2);
  return i + smooth(0.3, 0.8, x - i);
}

function initScroll() {
  if (window.Lenis && !reduceMotion) {
    lenis = new window.Lenis({ duration: 1.15, smoothWheel: true, wheelMultiplier: 1 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  ST.hero = ScrollTrigger.create({ trigger: '#hero', start: 'top top', end: 'bottom top' });
  ST.mani = ScrollTrigger.create({ trigger: '#sobre', start: 'top bottom', end: 'bottom top' });
  ST.reel = ScrollTrigger.create({
    trigger: '#reel', start: 'top top', end: () => `+=${innerHeight * (N - 1) * 0.9}`, pin: true, anticipatePin: 1,
  });
  const track = $('.gallery-track');
  const dist = () => Math.max(0, track.scrollWidth - innerWidth);
  ST.gallery = gsap.to(track, {
    x: () => -dist(),
    ease: 'none',
    scrollTrigger: { trigger: '#galeria', start: 'top top', end: () => `+=${dist()}`, pin: true, scrub: 0.6, invalidateOnRefresh: true, anticipatePin: 1 },
  });
  ST.gallery = ST.gallery.scrollTrigger;
  ST.prod = ScrollTrigger.create({
    trigger: '#embalagens', start: 'top top', end: () => `+=${innerHeight * (M - 1) * 1.1}`, pin: true, anticipatePin: 1,
  });
  ST.proc = ScrollTrigger.create({ trigger: '#processo', start: 'top bottom', end: 'bottom top' });
  ST.serv = ScrollTrigger.create({ trigger: '#servicos', start: 'top bottom', end: 'bottom top' });
  ST.contact = ScrollTrigger.create({ trigger: '#contato', start: 'top bottom', end: 'bottom bottom' });

  ScrollTrigger.addEventListener('refresh', computeKeys);
  ScrollTrigger.refresh();
  computeKeys();

  // velocidade do scroll → bolhas + marquee
  ScrollTrigger.create({
    start: 0,
    end: 'max',
    onUpdate: (self) => {
      state.velocity = self.getVelocity();
    },
  });
}

/* ==========================================================================
   LOOP
   ========================================================================== */
const bgLayer = $('.bg-layer');
const bgWord = $('.bg-word');
let lastBg = '';
let lastWord = -1;

function tick() {
  const now = performance.now();
  const dt = Math.min((now - (tick.last || now)) / 1000, 0.05);
  tick.last = now;
  state.time += dt;
  const s = window.scrollY;
  const vh = innerHeight;

  // ponteiro suavizado
  const pk = 1 - Math.exp(-dt * 4);
  state.pointer.sx += (state.pointer.x - state.pointer.sx) * pk;
  state.pointer.sy += (state.pointer.y - state.pointer.sy) * pk;
  state.velocity *= 0.9;

  // cores do fundo
  const col = colorAt(s);
  const bgStr = `rgb(${col.bg.join(',')})|rgba(${col.glow.join(',')},.55)|rgb(${col.accent.join(',')})`;
  if (bgStr !== lastBg) {
    const [bg, glow, accent] = bgStr.split('|');
    bgLayer.style.setProperty('--bg', bg);
    bgLayer.style.setProperty('--glow', glow);
    document.documentElement.style.setProperty('--accent-live', accent);
    lastBg = bgStr;
  }

  // DOM do showreel / embalagens
  const inReel = s > ST.reel.start - vh && s < ST.reel.end + vh;
  if (inReel) {
    const e = reelIndexAt(s);
    dom.reelItems.forEach((el, i) => {
      const d = e - i;
      const o = clamp(1 - Math.abs(d) * 2.2);
      el.style.opacity = o;
      el.style.transform = `translate3d(0, ${d * -70}px, 0)`;
      el.style.visibility = o > 0.01 ? 'visible' : 'hidden';
      el.setAttribute('aria-hidden', o > 0.5 ? 'false' : 'true');
    });
    const idx = Math.round(e);
    $('.reel-current').textContent = String(idx + 1).padStart(2, '0');
    $('.reel-bar i').style.transform = `scaleX(${(e + 1) / N})`;
    if (idx !== lastWord) {
      bgWord.textContent = COLLECTION[idx].name;
      lastWord = idx;
    }
    const wv = smooth(ST.reel.start - vh * 0.6, ST.reel.start, s) * (1 - smooth(ST.reel.end, ST.reel.end + vh * 0.6, s));
    const frac = e - Math.floor(e);
    bgWord.style.opacity = wv * (1 - Math.sin(frac * Math.PI) * 0.85) * 0.9;
  } else if (bgWord.style.opacity !== '0') bgWord.style.opacity = 0;

  const inProd = s > ST.prod.start - vh && s < ST.prod.end + vh;
  if (inProd) {
    const e = prodIndexAt(s);
    dom.prodItems.forEach((el, i) => {
      const d = e - i;
      const o = clamp(1 - Math.abs(d) * 2.2);
      el.style.opacity = o;
      el.style.transform = `translate3d(0, ${d * -70}px, 0)`;
      el.style.visibility = o > 0.01 ? 'visible' : 'hidden';
    });
    $('.products-current').textContent = String(Math.round(e) + 1).padStart(2, '0');
    $('.products-bar i').style.transform = `scaleX(${(e + 1) / M})`;
  }

  if (gl) renderGL(s, dt);
}

function renderGL(s, dt) {
  const { renderer, scene, camera, canRig, canSpin, tabPivot, labelMat, labels, U, bMat, items, rim } = gl;
  const vh = innerHeight;
  const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
  const halfW = halfH * camera.aspect;

  // pose da lata (com inércia)
  const target = poseAt(s);
  if (!state.cur) state.cur = { ...target };
  const k = 1 - Math.exp(-dt * 7);
  for (const key in target) state.cur[key] += (target[key] - state.cur[key]) * k;
  const c = state.cur;

  // rotação automática / arraste
  const w = clamp(c.auto);
  // só começa a girar sozinha depois que a lata pousa (fim da intro), de frente pra câmera
  state.auto += dt * 0.5 * w * smooth(0.92, 1, state.intro) * (reduceMotion ? 0.3 : 1) + state.autoVel;
  state.autoVel *= Math.pow(0.04, dt);
  state.auto = ((state.auto % TAU) + TAU) % TAU;
  if (w < 0.98 && Math.abs(state.autoVel) < 0.002) {
    const goal = state.auto > Math.PI ? TAU : 0;
    state.auto += (goal - state.auto) * (1 - w) * (1 - Math.exp(-dt * 2.5));
  }

  // rótulo atual + giro durante a troca no showreel
  const lab = labelAt(s);
  if (labelMat.map !== labels[lab.a].map) labelMat.map = labels[lab.a].map;
  U.uOrmA.value = labels[lab.a].orm;
  U.uMapB.value = labels[lab.b].map;
  U.uOrmB.value = labels[lab.b].orm;
  U.uMix.value = lab.mix;
  U.uTime.value = state.time;
  const reelSpin = lab.f !== undefined ? easeInOut(smooth(0.22, 0.88, lab.f)) * TAU : 0;

  const intro = state.intro;
  const float = Math.sin(state.time * 1.1) * 0.06;
  canRig.position.set(c.x * halfW, c.y * halfH + float + (1 - intro) * halfH * 1.6, 0);
  const sc = Math.max(0.0001, c.s * (0.55 + 0.45 * intro));
  canRig.scale.setScalar(sc);
  canRig.visible = c.s > 0.01;
  const face = Math.atan2(-canRig.position.x, camera.position.z) * 0.9;
  canRig.rotation.set(c.rx + state.pointer.sy * 0.12, face + state.pointer.sx * 0.18, c.rz - state.pointer.sx * 0.05);
  const sway = Math.sin(state.time * 0.6) * 0.32 * (1 - w);
  canSpin.rotation.y = state.auto + reelSpin + sway - (1 - intro) * 5;
  tabPivot.rotation.x = state.open * 1.05;

  // embalagens
  const pose = poses().prod;
  let dy = 0;
  if (s < ST.prod.start) dy = (-(ST.prod.start - s) / vh) * 2;
  else if (s > ST.prod.end) dy = ((s - ST.prod.end) / vh) * 2;
  const prodVisible = Math.abs(dy) < 2.6;
  gl.prodRig.visible = prodVisible;
  if (prodVisible) {
    gl.prodRig.position.set(pose.x * halfW, (pose.y + dy) * halfH, 0);
    gl.prodRig.rotation.set(state.pointer.sy * 0.1, state.pointer.sx * 0.2, 0);
    const e = prodIndexAt(s);
    items.forEach((it, i) => {
      const d = e - i;
      const vis = 1 - smooth(0.12, 0.5, Math.abs(d));
      it.rig.visible = vis > 0.001;
      it.rig.scale.setScalar(Math.max(0.0001, it.scale * pose.s * (0.4 + 0.6 * vis)) * (vis > 0.001 ? 1 : 0));
      it.rig.position.y = -d * 2.2;
      it.rig.rotation.set(it.tilt[0], 0, it.tilt[2]);
      const base = it.sway ? Math.sin(state.time * 0.7) * 0.55 : state.time * 0.45;
      it.spin.rotation.y = base + d * 3.2 + Math.atan2(-gl.prodRig.position.x, camera.position.z);
    });
  }

  // bolhas
  const speedBoost = 1 + Math.min(6, Math.abs(state.velocity) / 600) + state.burst * 8;
  state.rise += dt * 0.45 * speedBoost * (reduceMotion ? 0.3 : 1);
  bMat.uniforms.uRise.value = state.rise;
  bMat.uniforms.uTime.value = state.time;
  bMat.uniforms.uOpacity.value = 0.55 + state.burst * 0.45;

  // luz de recorte acompanha a cor do momento
  const col = colorAt(s).glow;
  rim.color.setRGB(col[0] / 255, col[1] / 255, col[2] / 255, THREE.SRGBColorSpace);

  // brilho de fundo segue a lata
  const v = canRig.position.clone().project(camera);
  bgLayer.style.setProperty('--gx', `${((v.x + 1) / 2) * 100}%`);
  bgLayer.style.setProperty('--gy', `${((1 - v.y) / 2) * 100}%`);

  renderer.render(scene, camera);
}

function onResize() {
  if (!gl) return;
  const { renderer, camera, bMat } = gl;
  renderer.setPixelRatio(Math.min(devicePixelRatio, isMobile() ? 1.75 : 2));
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  bMat.uniforms.uScale.value = innerHeight * renderer.getPixelRatio() * 0.5;
}

/* ==========================================================================
   INTERAÇÕES
   ========================================================================== */
function scrollToY(y, duration = 1.6, linear = false) {
  if (lenis) {
    lenis.scrollTo(y, { duration, easing: linear ? (t) => t : (t) => 1 - Math.pow(1 - t, 4) });
    return;
  }
  const proxy = { y: window.scrollY };
  const tw = gsap.to(proxy, {
    y, duration, ease: linear ? 'none' : 'power3.out', onUpdate: () => window.scrollTo(0, proxy.y),
  });
  const stop = () => {
    tw.kill();
    removeEventListener('wheel', stop);
    removeEventListener('touchstart', stop);
  };
  addEventListener('wheel', stop, { passive: true });
  addEventListener('touchstart', stop, { passive: true });
}

function targetFor(id) {
  if (id === 'reel') return ST.reel.start;
  if (id === 'galeria') return ST.gallery.start;
  if (id === 'embalagens') return ST.prod.start;
  if (id === 'hero') return 0;
  const el = document.getElementById(id);
  return el ? el.getBoundingClientRect().top + window.scrollY : 0;
}

function initUI() {
  // âncoras
  $$('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href').slice(1);
      if (!id) return;
      e.preventDefault();
      scrollToY(targetFor(id), 1.8);
      $('.nav')?.classList.remove('is-open');
    });
  });

  // "assistir ao reel": rola sozinho pelo showreel como um demoreel
  $('#play-reel')?.addEventListener('click', () => {
    const start = ST.reel.start;
    const end = ST.reel.end;
    if (lenis) {
      lenis.scrollTo(start, {
        duration: 1.6,
        onComplete: () => lenis.scrollTo(end, { duration: (N - 1) * 2.8, easing: (t) => t }),
      });
    } else {
      scrollToY(start, 1.2);
      setTimeout(() => scrollToY(end, (N - 1) * 2.8, true), 1300);
    }
  });

  // menu mobile
  $('.nav-toggle')?.addEventListener('click', () => $('.nav').classList.toggle('is-open'));

  // nav some ao descer, volta ao subir
  let lastY = 0;
  ScrollTrigger.create({
    start: 0,
    end: 'max',
    onUpdate: () => {
      const y = window.scrollY;
      $('.nav').classList.toggle('is-hidden', y > lastY && y > 200);
      $('.nav').classList.toggle('is-solid', y > 40);
      lastY = y;
    },
  });

  // ponteiro
  addEventListener('pointermove', (e) => {
    state.pointer.x = (e.clientX / innerWidth) * 2 - 1;
    state.pointer.y = (e.clientY / innerHeight) * 2 - 1;
  });

  // arrastar para girar a lata (hero)
  const drag = $('.hero-drag');
  let dragging = false;
  let px = 0;
  drag?.addEventListener('pointerdown', (e) => {
    dragging = true;
    px = e.clientX;
    drag.setPointerCapture(e.pointerId);
    document.body.classList.add('is-dragging');
  });
  drag?.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    state.autoVel = (e.clientX - px) * 0.006;
    px = e.clientX;
  });
  const end = () => {
    dragging = false;
    document.body.classList.remove('is-dragging');
  };
  drag?.addEventListener('pointerup', end);
  drag?.addEventListener('pointercancel', end);

  // CTA: abre o lacre e solta o gás
  $$('[data-open-can]').forEach((el) => {
    el.addEventListener('pointerenter', () => gsap.to(state, { open: 1, burst: 0.6, duration: 0.6, ease: 'back.out(2)' }));
    el.addEventListener('pointerleave', () => gsap.to(state, { open: 0, burst: 0, duration: 0.8, ease: 'power2.out' }));
    el.addEventListener('click', () => {
      gsap.fromTo(state, { burst: 1 }, { burst: 0, duration: 2.4, ease: 'power2.out' });
      gsap.to(state, { open: 1, duration: 0.3 });
    });
  });

  // botões magnéticos
  if (finePointer) {
    $$('.magnetic').forEach((el) => {
      const xTo = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'elastic.out(1, 0.4)' });
      const yTo = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'elastic.out(1, 0.4)' });
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        xTo((e.clientX - r.left - r.width / 2) * 0.3);
        yTo((e.clientY - r.top - r.height / 2) * 0.4);
      });
      el.addEventListener('pointerleave', () => {
        xTo(0);
        yTo(0);
      });
    });
  }

  // cursor customizado
  if (finePointer && !reduceMotion) {
    const cur = $('.cursor');
    const label = $('.cursor-label');
    document.body.classList.add('has-cursor');
    const pos = { x: innerWidth / 2, y: innerHeight / 2 };
    const ring = { x: pos.x, y: pos.y };
    addEventListener('pointermove', (e) => {
      pos.x = e.clientX;
      pos.y = e.clientY;
    });
    gsap.ticker.add(() => {
      ring.x += (pos.x - ring.x) * 0.18;
      ring.y += (pos.y - ring.y) * 0.18;
      cur.style.setProperty('--x', `${pos.x}px`);
      cur.style.setProperty('--y', `${pos.y}px`);
      cur.style.setProperty('--rx', `${ring.x}px`);
      cur.style.setProperty('--ry', `${ring.y}px`);
    });
    document.addEventListener('pointerover', (e) => {
      const t = e.target.closest('[data-cursor], a, button');
      cur.classList.toggle('is-hover', !!t);
      const txt = t?.dataset?.cursor || '';
      label.textContent = txt;
      cur.classList.toggle('has-label', !!txt);
    });
    document.addEventListener('pointerleave', () => cur.classList.add('is-out'));
    document.addEventListener('pointerenter', () => cur.classList.remove('is-out'));
  }

  // pranchas com inclinação 3D
  if (finePointer) {
    $$('.sheet-frame').forEach((f) => {
      const inner = $('.sheet-inner', f);
      f.addEventListener('pointermove', (e) => {
        const r = f.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        inner.style.transform = `rotateY(${x * 14}deg) rotateX(${-y * 12}deg) translateZ(20px)`;
        inner.style.setProperty('--gx', `${(x + 0.5) * 100}%`);
        inner.style.setProperty('--gy', `${(y + 0.5) * 100}%`);
      });
      f.addEventListener('pointerleave', () => {
        inner.style.transform = '';
      });
    });
  }

  // marquee reage à velocidade do scroll
  const skewTo = gsap.quickTo('.marquee-inner', 'skewX', { duration: 0.5, ease: 'power3' });
  gsap.ticker.add(() => skewTo(clamp(state.velocity / -250, -12, 12)));

  // manifesto palavra por palavra
  const mt = $('.manifesto-text');
  if (mt) {
    mt.innerHTML = mt.textContent
      .trim()
      .split(/\s+/)
      .map((w) => `<span class="w">${w}</span>`)
      .join(' ');
    gsap.to($$('.w', mt), {
      opacity: 1,
      stagger: 0.08,
      ease: 'none',
      scrollTrigger: { trigger: mt, start: 'top 82%', end: 'bottom 50%', scrub: true },
    });
  }

  // revelações
  $$('.reveal').forEach((el) => {
    gsap.from(el, {
      y: 60,
      opacity: 0,
      duration: 1.2,
      ease: 'expo.out',
      scrollTrigger: { trigger: el, start: 'top 88%' },
    });
  });

  // contadores
  $$('[data-count]').forEach((el) => {
    const n = { v: 0 };
    const to = +el.dataset.count;
    gsap.to(n, {
      v: to,
      duration: 2,
      ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 90%' },
      onUpdate: () => {
        el.textContent = String(Math.round(n.v)).padStart(el.dataset.pad ? +el.dataset.pad : 1, '0');
      },
    });
  });

  // passos do processo
  $$('.step').forEach((el) => {
    ScrollTrigger.create({ trigger: el, start: 'top 62%', end: 'bottom 38%', toggleClass: 'is-active' });
  });

  addEventListener('resize', onResize);
}

/* ==========================================================================
   INTRO
   ========================================================================== */
function splitHero() {
  $$('.hero-name .word').forEach((w) => {
    w.innerHTML = [...w.textContent].map((ch) => `<span class="ch">${ch}</span>`).join('');
  });
}

async function hideLoader() {
  loader.set(100);
  await new Promise((r) => setTimeout(r, 450));
  await gsap.to(loader.el, { clipPath: 'inset(0 0 100% 0)', duration: 1.1, ease: 'expo.inOut' });
  loader.el.remove();
  loader.el = null;
}

function intro() {
  const tl = gsap.timeline();
  tl.from('.hero-name .ch', { yPercent: 115, duration: 1.5, ease: 'expo.out', stagger: 0.04 }, 0)
    .to(state, { intro: 1, duration: 2.4, ease: 'expo.out' }, 0.15)
    .from('.hero-ui > *', { y: 30, opacity: 0, duration: 1.1, ease: 'expo.out', stagger: 0.08 }, 0.5)
    .from('.nav', { y: -30, opacity: 0, duration: 1, ease: 'expo.out' }, 0.6);
}

/* ==========================================================================
   INÍCIO
   ========================================================================== */
async function init() {
  // ruído do grão
  const n = document.createElement('canvas');
  n.width = n.height = 160;
  const nc = n.getContext('2d');
  const img = nc.createImageData(160, 160);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() * 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  nc.putImageData(img, 0, 0);
  document.documentElement.style.setProperty('--noise', `url(${n.toDataURL()})`);

  splitHero();
  loader.set(8);
  await loadFonts();
  loader.set(30);
  const L = await buildLabels((p) => loader.set(30 + p * 45));
  buildDom(L);
  loader.set(80);
  try {
    gl = initGL(L);
    onResize();
  } catch (err) {
    console.warn('WebGL indisponível — exibindo versão estática.', err);
    document.documentElement.classList.add('no-webgl');
    state.intro = 1;
  }
  loader.set(94);
  initScroll();
  initUI();
  gsap.ticker.add(tick);
  window.__siteReady = true;
  await hideLoader();
  if (gl) intro();
  else gsap.from('.hero-name .ch', { yPercent: 115, duration: 1.4, ease: 'expo.out', stagger: 0.04 });
  ScrollTrigger.refresh();
}

init();
