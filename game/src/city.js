// Procedural Santa Aurelia: a golden-hour grid city built from a seed —
// roads, blocks, towers, palms, beach, docks, a lighthouse — plus the
// collision and road-network helpers every other system drives on.
import * as THREE from '../vendor/three.module.min.js';
import { CITY, PALETTE, PLACES } from './config.js';
import { range, rangeInt, pick, chance, hash2 } from './random.js';
import { makeGroundTexture, makeFacadeTexture, makeSignTexture } from './textures.js';

export function roadCoords() {
  const out = [];
  for (let i = 0; i <= CITY.blocksPerSide; i++) out.push((i - CITY.blocksPerSide / 2) * CITY.pitch);
  return out;
}

export function blockCentres() {
  const out = [];
  for (let i = 0; i < CITY.blocksPerSide; i++) out.push((i - (CITY.blocksPerSide - 1) / 2) * CITY.pitch);
  return out;
}

// Push a circle (player, car, ped) out of every building AABB it overlaps.
// Mutates pos; returns the push-out normal, or null when nothing was hit.
export function collideCircle(pos, radius, colliders) {
  let hit = null;
  for (const c of colliders) {
    const cx = Math.max(c.minX, Math.min(pos.x, c.maxX));
    const cz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
    const dx = pos.x - cx;
    const dz = pos.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= radius * radius) continue;
    if (d2 > 1e-6) {
      const d = Math.sqrt(d2);
      const push = radius - d;
      pos.x += (dx / d) * push;
      pos.z += (dz / d) * push;
      hit = { x: dx / d, z: dz / d };
    } else {
      // Centre inside the box: shove out along the smallest penetration.
      const pl = pos.x - c.minX, pr = c.maxX - pos.x;
      const pt = pos.z - c.minZ, pb = c.maxZ - pos.z;
      const m = Math.min(pl, pr, pt, pb);
      if (m === pl) { pos.x = c.minX - radius; hit = { x: -1, z: 0 }; }
      else if (m === pr) { pos.x = c.maxX + radius; hit = { x: 1, z: 0 }; }
      else if (m === pt) { pos.z = c.minZ - radius; hit = { x: 0, z: -1 }; }
      else { pos.z = c.maxZ + radius; hit = { x: 0, z: 1 }; }
    }
  }
  return hit;
}

function makePalm(rng) {
  const palm = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7a5230, roughness: 0.9 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f8f4e, roughness: 0.8 });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, 6.5, 6), trunkMat);
  trunk.position.y = 3.25;
  trunk.castShadow = true;
  palm.add(trunk);
  const frondGeo = new THREE.ConeGeometry(0.55, 3.6, 4);
  for (let i = 0; i < 8; i++) {
    const frond = new THREE.Mesh(frondGeo, leafMat);
    frond.scale.set(1, 1, 0.16);
    const a = (i / 8) * Math.PI * 2;
    frond.position.set(Math.cos(a) * 1.2, 6.6, Math.sin(a) * 1.2);
    frond.rotation.set(Math.sin(a) * 1.15, 0, -Math.cos(a) * 1.15);
    palm.add(frond); // fronds skip the shadow pass: the trunk's shadow is enough
  }
  const nuts = new THREE.Mesh(new THREE.SphereGeometry(0.3, 6, 5), new THREE.MeshStandardMaterial({ color: 0x6b4a2a }));
  nuts.position.y = 6.4;
  palm.add(nuts);
  palm.rotation.z = range(rng, -0.08, 0.08);
  return palm;
}

export function buildCity(scene, rng) {
  const roads = roadCoords();
  const blocks = blockCentres();
  const extent = roads[roads.length - 1] + CITY.roadWidth / 2;
  const colliders = [];
  const parkingSpots = [];
  const facadeCache = new Map();

  function facade(baseColor, floors, cols) {
    const key = `${baseColor}|${floors}|${cols}`;
    if (!facadeCache.has(key)) {
      facadeCache.set(key, makeFacadeTexture(rng, baseColor, floors, cols));
    }
    return facadeCache.get(key);
  }

  // Ground: one textured plane carrying every road and sidewalk.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY.groundSize, CITY.groundSize),
    new THREE.MeshStandardMaterial({ map: makeGroundTexture({ coords: roads, blockCentres: blocks, extent }), roughness: 0.95 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Sea plane, slightly above the ground texture's painted water.
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY.groundSize / 2 - CITY.waterX, CITY.groundSize),
    new THREE.MeshStandardMaterial({ color: PALETTE.sea, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.92 }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set((CITY.waterX + CITY.groundSize / 2) / 2, 0.06, 0);
  scene.add(sea);

  const roofMat = new THREE.MeshStandardMaterial({ color: 0x6d6a63, roughness: 0.9 });
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);

  function addBuilding(cx, cz, w, d, h) {
    const floors = Math.max(2, Math.round(h / 3.4));
    const cols = Math.max(2, Math.round(w / 4.5));
    const side = new THREE.MeshStandardMaterial({ map: facade(pick(rng, PALETTE.building), floors, cols), roughness: 0.85 });
    const mesh = new THREE.Mesh(boxGeo, [side, side, roofMat, roofMat, side, side]);
    mesh.scale.set(w, h, d);
    mesh.position.set(cx, h / 2, cz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    colliders.push({ minX: cx - w / 2 - 0.3, maxX: cx + w / 2 + 0.3, minZ: cz - d / 2 - 0.3, maxZ: cz + d / 2 + 0.3 });
    // Rooftop props.
    if (chance(rng, 0.45)) {
      const ac = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({ color: 0x9a9a92, roughness: 0.9 }));
      ac.scale.set(range(rng, 1.5, 3), 1.1, range(rng, 1.5, 3));
      ac.position.set(cx + range(rng, -w / 4, w / 4), h + 0.55, cz + range(rng, -d / 4, d / 4));
      scene.add(ac);
    }
    if (h > 26 && chance(rng, 0.5)) {
      const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 7, 5), new THREE.MeshStandardMaterial({ color: 0x555550 }));
      antenna.position.set(cx, h + 3.5, cz);
      scene.add(antenna);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.28, 6, 5), new THREE.MeshStandardMaterial({ color: 0xff4444, emissive: 0xff2222 }));
      tip.position.set(cx, h + 7, cz);
      scene.add(tip);
    }
    return mesh;
  }

  // Blocks: towers downtown, low shops at the edges, a few parking lots.
  for (const bx of blocks) {
    for (const bz of blocks) {
      const distCentre = Math.hypot(bx, bz);
      const downtown = Math.max(0, 1 - distCentre / 260);
      if (hash2(bx, bz) < 0.14) {
        // Parking lot: flat, with marked spots for parked cars.
        for (let r = 0; r < 2; r++) {
          for (let k = 0; k < 3; k++) {
            parkingSpots.push({ x: bx - 12 + k * 11, z: bz - 6 + r * 13, heading: Math.PI / 2 });
          }
        }
        const palm = makePalm(rng);
        palm.position.set(bx + 18, 0, bz + 18);
        scene.add(palm);
        continue;
      }
      const layout = rng();
      if (layout < 0.3) {
        const h = range(rng, 10, 18) + downtown * range(rng, 14, 30);
        addBuilding(bx, bz, range(rng, 26, 32), range(rng, 26, 32), h);
      } else if (layout < 0.7) {
        const h1 = range(rng, 7, 12) + downtown * range(rng, 8, 22);
        const h2 = range(rng, 7, 12) + downtown * range(rng, 8, 22);
        addBuilding(bx - 10, bz, 19, 34, h1);
        addBuilding(bx + 11, bz, 19, 34, h2);
      } else {
        for (const [ox, oz] of [[-10, -10], [10, -10], [-10, 10], [10, 10]]) {
          const h = range(rng, 6, 11) + downtown * range(rng, 4, 16);
          addBuilding(bx + ox, bz + oz, 18, 18, h);
        }
      }
    }
  }

  // Streetlights at alternating intersections.
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x3c4147, roughness: 0.6, metalness: 0.4 });
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xfff6c9, emissive: 0xffedb0, emissiveIntensity: 0.7 });
  let li = 0;
  for (const rx of roads) {
    for (const rz of roads) {
      if ((li++ % 2) !== 0) continue;
      const pole = new THREE.Group();
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 7.5, 6), poleMat);
      shaft.position.y = 3.75;
      shaft.castShadow = true;
      pole.add(shaft);
      const arm = new THREE.Mesh(boxGeo, poleMat);
      arm.scale.set(2.2, 0.14, 0.14);
      arm.position.set(1, 7.4, 0);
      pole.add(arm);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), lampMat);
      lamp.position.set(2, 7.3, 0);
      pole.add(lamp);
      pole.position.set(rx + CITY.roadWidth / 2 + 1.2, 0, rz + CITY.roadWidth / 2 + 1.2);
      pole.rotation.y = rng() * Math.PI * 2;
      scene.add(pole);
    }
  }

  // Palm rows along the beach avenue and a few downtown.
  for (let z = -190; z <= 190; z += 24) {
    const palm = makePalm(rng);
    palm.position.set(210, 0, z + range(rng, -3, 3));
    scene.add(palm);
  }
  for (let i = 0; i < 14; i++) {
    const palm = makePalm(rng);
    const bx = pick(rng, blocks);
    const bz = pick(rng, blocks);
    palm.position.set(bx + pick(rng, [-20, 20]), 0, bz + range(rng, -18, 18));
    scene.add(palm);
  }

  // Billboards with original Santa Aurelia advertising.
  const signs = [
    { text: ['SANTA AURELIA', 'SUN • SEA • SPEED'], x: -29, z: -87, rotY: 0 },
    { text: ['DELGADO MOTORS', 'CARS • CASH • NO QUESTIONS'], x: 87, z: 87, rotY: Math.PI / 2 },
    { text: ['HOTEL MIRAMONTE', 'SLEEP LIKE A KINGPIN'], x: -145, z: -29, rotY: 0 },
    { text: ['GOLDEN TIDE', 'THE SUN SETS AT 17:41'], x: 29, z: 145, rotY: Math.PI },
  ];
  for (const s of signs) {
    const board = new THREE.Group();
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(13, 6.5),
      new THREE.MeshStandardMaterial({ map: makeSignTexture(s.text, '#12283a', '#ffd98a'), side: THREE.DoubleSide, roughness: 0.8 }),
    );
    face.position.y = 9;
    face.castShadow = true;
    board.add(face);
    for (const px of [-4, 4]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 9, 6), poleMat);
      leg.position.set(px, 4.5, 0);
      board.add(leg);
    }
    board.position.set(s.x, 0, s.z);
    board.rotation.y = s.rotY;
    scene.add(board);
  }

  // South docks: containers, crates and a pier into the sea.
  const containerColors = [0xc0392b, 0x2980b9, 0x27ae60, 0xe67e22, 0x8e44ad];
  for (let i = 0; i < 8; i++) {
    const w = range(rng, 5, 7);
    const d = range(rng, 2.4, 3);
    const h = range(rng, 2.4, 3);
    const cx = 196 + (i % 4) * 8;
    const cz = 128 + Math.floor(i / 4) * 9;
    const box = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({ color: pick(rng, containerColors), roughness: 0.8 }));
    box.scale.set(w, h, d);
    box.position.set(cx, h / 2, cz);
    box.castShadow = true;
    scene.add(box);
    colliders.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });
  }
  const pier = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({ color: 0x8a6b45, roughness: 0.9 }));
  pier.scale.set(42, 0.8, 7);
  pier.position.set(246, 0.4, 145);
  pier.castShadow = true;
  scene.add(pier);

  // Lighthouse on the beach: a golden-hour silhouette at the east edge.
  const lightTower = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2, 3.2, 22, 10),
    new THREE.MeshStandardMaterial({ color: 0xf2e8d8, roughness: 0.85 }),
  );
  lightTower.position.set(232, 11, -120);
  lightTower.castShadow = true;
  scene.add(lightTower);
  const lightBand = new THREE.Mesh(
    new THREE.CylinderGeometry(2.45, 2.65, 3, 10),
    new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.85 }),
  );
  lightBand.position.set(232, 15, -120);
  scene.add(lightBand);
  const lampRoom = new THREE.Mesh(
    new THREE.SphereGeometry(1.6, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xfff2b0, emissive: 0xffedb0, emissiveIntensity: 1.8 }),
  );
  lampRoom.position.set(232, 23, -120);
  scene.add(lampRoom);
  colliders.push({ minX: 229, maxX: 235, minZ: -123, maxZ: -117 });

  const city = {
    roads,
    blocks,
    extent,
    colliders,
    parkingSpots,
    spots: PLACES,
    bounds: { min: -extent - 8, max: extent + 8, waterX: CITY.waterX },
  };

  city.nearestRoadCoord = (v) => roads.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a), roads[0]);
  city.nearestIntersection = (x, z) => ({ x: city.nearestRoadCoord(x), z: city.nearestRoadCoord(z) });
  city.randomRoadPoint = (rngFn) => {
    const horizontal = rngFn() < 0.5;
    const road = pick(rngFn, roads);
    const along = range(rngFn, -extent + 10, extent - 10);
    return horizontal ? { x: along, z: road } : { x: road, z: along };
  };
  city.randomSidewalkPoint = (rngFn) => {
    const bx = pick(rngFn, blocks);
    const bz = pick(rngFn, blocks);
    const side = rangeInt(rngFn, 0, 3);
    const o = CITY.blockSize / 2 - 1.5;
    if (side === 0) return { x: bx + range(rngFn, -o, o), z: bz - o };
    if (side === 1) return { x: bx + range(rngFn, -o, o), z: bz + o };
    if (side === 2) return { x: bx - o, z: bz + range(rngFn, -o, o) };
    return { x: bx + o, z: bz + range(rngFn, -o, o) };
  };
  // Greedy grid step: from an intersection, the neighbour that gets closest
  // to the target intersection. Police route on this.
  city.gridStepTowards = (from, to) => {
    const step = CITY.pitch;
    const options = [
      { x: from.x + step, z: from.z },
      { x: from.x - step, z: from.z },
      { x: from.x, z: from.z + step },
      { x: from.x, z: from.z - step },
    ].filter((p) => Math.abs(p.x) <= extent && Math.abs(p.z) <= extent);
    let best = options[0];
    let bestD = Infinity;
    for (const p of options) {
      const d = Math.hypot(p.x - to.x, p.z - to.z);
      if (d < bestD) { bestD = d; best = p; }
    }
    return best;
  };
  return city;
}
