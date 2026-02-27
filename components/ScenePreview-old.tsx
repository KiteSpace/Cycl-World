import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { SceneDef } from "../types";

interface ScenePreviewProps {
  sceneConfig: SceneDef;
}

export default function ScenePreview({ sceneConfig }: ScenePreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    animationId: number;
  } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Setup Three.js
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 600);
    
    // Apply camera from scene config
    const cam = sceneConfig.camera || { posY: 1.6, lookY: 1.4, lookZ: -15 };
    camera.position.set(0, cam.posY ?? 1.6, 0);
    camera.lookAt(0, cam.lookY ?? 1.4, cam.lookZ ?? -15);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    container.appendChild(renderer.domElement);

    // Create layers based on config
    sceneConfig.layers.forEach((layer) => {
      if (layer.kind === "background_gradient") {
        createBackgroundGradient(scene, layer.params);
      } else if (layer.kind === "road_v9") {
        createSimpleRoad(scene, layer.params);
      } else if (layer.kind === "mountains_v9") {
        createSimpleMountains(scene, layer.params);
      } else if (layer.kind === "asteroids_v9") {
        createSimpleAsteroids(scene, layer.params);
      } else if (layer.kind === "star_trails") {
        createSimpleStarTrails(scene, layer.params);
      } else if (layer.kind === "haze") {
        createSimpleHaze(scene, layer.params);
      }
    });

    // Add basic lighting
    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(5, 10, 5);
    scene.add(light);
    scene.add(new THREE.AmbientLight(0x404040, 0.5));

    // Store animation ID separately to avoid ref issues
    let animationId = 0;

    // Animation loop
    const clock = new THREE.Clock();
    const animate = () => {
      const time = clock.getElapsedTime();
      
      // Animate layers
      scene.traverse((obj) => {
        if (obj.userData.animate) {
          obj.userData.animate(time);
        }
      });

      renderer.render(scene, camera);
      animationId = requestAnimationFrame(animate);
    };
    
    // Store ref before starting animation
    sceneRef.current = { scene, camera, renderer, animationId: 0 };
    
    // Start animation
    animate();

    // Cleanup
    return () => {
      cancelAnimationFrame(animationId);
      if (sceneRef.current) {
        renderer.dispose();
        if (container.contains(renderer.domElement)) {
          container.removeChild(renderer.domElement);
        }
        sceneRef.current = null;
      }
    };
  }, [sceneConfig]);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100%",
        background: "#000",
      }}
    />
  );
}

// Simplified layer creators for preview

function createBackgroundGradient(scene: THREE.Scene, params: any) {
  const geometry = new THREE.SphereGeometry(500, 32, 32);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      colorTop: { value: new THREE.Color(params?.colorTop || "#000011") },
      colorMid: { value: new THREE.Color(params?.colorMid || "#001133") },
      colorBottom: { value: new THREE.Color(params?.colorBottom || "#000011") },
      colorHorizon: { value: new THREE.Color(params?.colorHorizon || "#2244ff") },
    },
    vertexShader: `
      varying vec3 vPosition;
      void main() {
        vPosition = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 colorTop;
      uniform vec3 colorMid;
      uniform vec3 colorBottom;
      uniform vec3 colorHorizon;
      varying vec3 vPosition;
      
      void main() {
        vec3 dir = normalize(vPosition);
        float v = dir.y * 0.5 + 0.5;
        
        vec3 c;
        if (v > 0.5) {
          c = mix(colorMid, colorTop, (v - 0.5) * 2.0);
        } else {
          c = mix(colorBottom, colorMid, v * 2.0);
        }
        
        // Horizon glow
        float horizonGlow = exp(-pow((v - 0.42) * 8.0, 2.0)) * 0.3;
        c = mix(c, colorHorizon, horizonGlow);
        
        gl_FragColor = vec4(c, 1.0);
      }
    `,
    side: THREE.BackSide,
    depthWrite: false,
  });
  
  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);
}

function createSimpleRoad(scene: THREE.Scene, params: any) {
  const style = params?.style || "grid";
  const colors = params?.colors || {};
  const roadColor = new THREE.Color(colors.road || "#1a0022");
  const edgeColor = new THREE.Color(colors.edge || "#ff69b4");
  const lineColor = new THREE.Color(colors.line || "#ff1493");

  // Road surface
  const roadGeo = new THREE.PlaneGeometry(5, 200, 1, 40);
  const roadMat = new THREE.MeshBasicMaterial({
    color: roadColor,
    transparent: true,
    opacity: 0.8,
  });
  const road = new THREE.Mesh(roadGeo, roadMat);
  road.rotation.x = -Math.PI / 2;
  road.position.z = -100;
  scene.add(road);

  // Edge glow lines
  const edgeGeo = new THREE.PlaneGeometry(0.2, 200);
  const edgeMat = new THREE.MeshBasicMaterial({
    color: edgeColor,
    transparent: true,
    opacity: 0.9,
  });
  
  const leftEdge = new THREE.Mesh(edgeGeo, edgeMat);
  leftEdge.rotation.x = -Math.PI / 2;
  leftEdge.position.set(-2.5, 0.05, -100);
  scene.add(leftEdge);
  
  const rightEdge = new THREE.Mesh(edgeGeo, edgeMat);
  rightEdge.rotation.x = -Math.PI / 2;
  rightEdge.position.set(2.5, 0.05, -100);
  scene.add(rightEdge);

  // Grid lines (if grid style)
  if (style === "grid") {
    for (let i = 0; i < 10; i++) {
      const lineGeo = new THREE.PlaneGeometry(5, 0.1);
      const lineMat = new THREE.MeshBasicMaterial({
        color: lineColor,
        transparent: true,
        opacity: 0.6,
      });
      const line = new THREE.Mesh(lineGeo, lineMat);
      line.rotation.x = -Math.PI / 2;
      line.position.set(0, 0.06, -i * 20);
      scene.add(line);
    }
  }
}

function createSimpleMountains(scene: THREE.Scene, params: any) {
  const lineColor = new THREE.Color(params?.lineColor || "#ff2244");
  
  // Create simple wireframe mountains on both sides
  for (const side of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      const geometry = new THREE.PlaneGeometry(30, 40, 30, 40);
      const vertices = geometry.attributes.position.array;
      
      // Add simple height variation
      for (let j = 0; j < vertices.length; j += 3) {
        const x = vertices[j];
        const y = vertices[j + 1];
        const noise = Math.sin(x * 0.3 + i) * Math.cos(y * 0.2) * 5;
        vertices[j + 2] = Math.max(0, noise + Math.abs(x) * 0.3);
      }
      geometry.attributes.position.needsUpdate = true;
      geometry.computeVertexNormals();
      
      const material = new THREE.MeshBasicMaterial({
        color: lineColor,
        wireframe: true,
        transparent: true,
        opacity: 0.7,
      });
      
      const mesh = new THREE.Mesh(geometry, material);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(side * 20, 0, -i * 40 - 20);
      scene.add(mesh);
    }
  }
}

function createSimpleAsteroids(scene: THREE.Scene, params: any) {
  const count = params?.count || 30;
  const baseColor = new THREE.Color(params?.baseColor || "#444455");
  
  for (let i = 0; i < Math.min(count, 30); i++) {
    const size = 0.5 + Math.random() * 2;
    const geometry = new THREE.IcosahedronGeometry(size, 1);
    const material = new THREE.MeshStandardMaterial({
      color: baseColor,
      wireframe: Math.random() > 0.5,
      transparent: true,
      opacity: 0.8,
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    const angle = Math.random() * Math.PI * 2;
    const distance = 10 + Math.random() * 40;
    mesh.position.set(
      Math.cos(angle) * distance,
      Math.random() * 20 + 2,
      -Math.random() * 400 - 50
    );
    
    mesh.userData.animate = (time: number) => {
      mesh.rotation.x += 0.01;
      mesh.rotation.y += 0.01;
    };
    
    scene.add(mesh);
  }
}

function createSimpleStarTrails(scene: THREE.Scene, params: any) {
  const count = params?.count || 500; // Use fewer for preview
  const color = new THREE.Color(params?.color || "#8855ff");
  
  const geometry = new THREE.BufferGeometry();
  const positions = [];
  const colors = [];
  
  for (let i = 0; i < Math.min(count, 500); i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 5 + Math.random() * 30;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    const z = -Math.random() * 400 - 50;
    const length = 5 + Math.random() * 15;
    
    // Head
    positions.push(x, y, z);
    colors.push(color.r, color.g, color.b);
    
    // Tail
    positions.push(x, y, z - length);
    colors.push(color.r * 0.2, color.g * 0.2, color.b * 0.2);
  }
  
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  
  const material = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.8,
  });
  
  const lines = new THREE.LineSegments(geometry, material);
  scene.add(lines);
}

function createSimpleHaze(scene: THREE.Scene, params: any) {
  const color = new THREE.Color(params?.color || "#4400ff");
  const intensity = params?.intensity || 0.6;
  
  // Create fog
  scene.fog = new THREE.FogExp2(color.getHex(), 0.002 * intensity);
  
  // Add ambient particles
  const geometry = new THREE.BufferGeometry();
  const positions = [];
  
  for (let i = 0; i < 100; i++) {
    positions.push(
      (Math.random() - 0.5) * 100,
      Math.random() * 20,
      -Math.random() * 300
    );
  }
  
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  
  const material = new THREE.PointsMaterial({
    color,
    size: 2,
    transparent: true,
    opacity: intensity * 0.3,
  });
  
  const points = new THREE.Points(geometry, material);
  scene.add(points);
}
