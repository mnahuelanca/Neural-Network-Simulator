import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

export class Visualizer {
    constructor(containerId, network) {
        this.network = network;
        this.container = document.getElementById(containerId);
        this.initThree();
        this.initEnvironment();
    }

    initThree() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x050508);
        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth/window.innerHeight, 0.1, 2000);
        this.camera.position.set(0, 5, 35);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.container.innerHTML = '';
        this.container.appendChild(this.renderer.domElement);

        // Bloom
        const renderPass = new RenderPass(this.scene, this.camera);
        const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
        bloomPass.strength = 1.2; bloomPass.radius = 0.5;
        
        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(renderPass);
        this.composer.addPass(bloomPass);

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.minDistance = 30; this.controls.maxDistance = 60;
        
        this.neuronMeshes = []; this.connMeshes = [];
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth/window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
            this.composer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    initEnvironment() {
        const grid = new THREE.GridHelper(2000, 100, 0x333333, 0x002233);
        grid.position.y = -10; this.scene.add(grid);
        const amb = new THREE.AmbientLight(0xffffff, 0.8); this.scene.add(amb);
        const dir = new THREE.DirectionalLight(0xffffff, 1); dir.position.set(10, 20, 10); this.scene.add(dir);
        
        const pGeo = new THREE.BufferGeometry();
        const pos = new Float32Array(3000);
        for(let i=0; i<3000; i++) pos[i] = (Math.random()-0.5)*400;
        pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        this.scene.add(new THREE.Points(pGeo, new THREE.PointsMaterial({size:0.5, color:0x00aaff})));
    }

    rebuild() {
        const label = document.getElementById('winner-label');
        if(label) label.style.display = 'none';
        this.neuronMeshes.forEach(m => this.scene.remove(m));
        this.connMeshes.forEach(c => this.scene.remove(c.mesh));
        this.neuronMeshes = []; this.connMeshes = [];
        const layers = this.network.layers;
        const spacingX = 12, spacingY = 4, geo = new THREE.SphereGeometry(0.7, 32, 32);
        
        layers.forEach((count, l) => {
            const layerX = (l - (layers.length-1)/2) * spacingX;
            for(let i=0; i<count; i++) {
                const y = -((count-1)*spacingY)/2 + (i*spacingY);
                const mat = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0x000000 });
                const mesh = new THREE.Mesh(geo, mat);
                mesh.position.set(layerX, y, 0);
                mesh.userData = { type: 'neuron', l, i };
                this.scene.add(mesh);
                this.neuronMeshes.push(mesh);
                this.network.neurons[l][i].pos = mesh.position;
            }
        });
        for(let l=0; l<layers.length-1; l++) {
            for(let i=0; i<layers[l]; i++) {
                for(let j=0; j<layers[l+1]; j++) {
                    const pts = [this.network.neurons[l][i].pos, this.network.neurons[l+1][j].pos];
                    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({color:0xffffff, transparent:true, opacity:0.1}));
                    line.userData = {type:'line', l, from:i, to:j};
                    this.scene.add(line);
                    this.connMeshes.push({mesh:line, l, from:i, to:j});
                }
            }
        }
    }

    updateVisuals(targets, hoveredObj, isTraining) {
        const focusL = (hoveredObj && hoveredObj.userData.type==='neuron') ? hoveredObj.userData.l : -1;
        const focusI = (focusL > -1) ? hoveredObj.userData.i : -1;
        
        let idx = 0;
        let maxOutputVal = -Infinity; 
        let winnerMesh = null; 
        let winnerIndex = -1;

        this.network.neurons.forEach((layer, l) => {
            const isOut = (l === this.network.layers.length-1);
            layer.forEach((n, i) => {
                const mesh = this.neuronMeshes[idx];
                const val = n.value;
                if (isOut && val > maxOutputVal) { 
                    maxOutputVal = val; 
                    winnerMesh = mesh; 
                    winnerIndex = i; 
                }
                
                const col = new THREE.Color();
                if(isOut) {
                    const diff = Math.abs(val - (targets[i]||0));
                    if(!isTraining && val > 0.7) col.setHex(0x00ff00);
                    else col.setHSL(0.33 * Math.max(0, 1-diff), 1, 0.5);
                } else col.setHSL(0.6, 1, 0.2 + val*0.5);

                mesh.material.color.copy(col);
                mesh.material.emissive.copy(col);
                mesh.material.emissiveIntensity = 0.3 + val*2;
                mesh.scale.setScalar(0.6 + val*0.5);
                idx++;
            });
        });

        this.connMeshes.forEach(c => {
            const w = this.network.weights[c.l][c.from][c.to];
            const v = this.network.neurons[c.l][c.from].value;
            let op = Math.abs(w)*v;
            if(op<0.05) op=0.02;
            c.mesh.material.color.setHex(w>0 ? 0x00ffff : 0xff0055);
            if(hoveredObj) {
                if(c.mesh===hoveredObj) { op=1; c.mesh.material.color.setHex(0xffffff); }
                else if(focusL > -1) {
                    const linked = (c.l===focusL && c.from===focusI) || (c.l===focusL-1 && c.to===focusI);
                    op = linked ? 0.8 : 0.05;
                } else op=0.05;
            }
            c.mesh.material.opacity = op;
        });
        
        this.updateWinnerLabel(winnerMesh, winnerIndex, maxOutputVal, isTraining);
        this.composer.render();
    }

    updateWinnerLabel(mesh, index, value, isTraining) {
        const label = document.getElementById('winner-label');
        if(!isTraining && mesh && value > 0.6 && label) {
            const p = mesh.position.clone();
            p.x += 2; p.y += 0.5; p.project(this.camera);
            if(p.z < 1) {
                label.style.display = 'block';
                label.style.left = (p.x*0.5+0.5)*window.innerWidth + 'px';
                label.style.top = (-p.y*0.5+0.5)*window.innerHeight + 'px';
                label.style.transform = 'translate(0,-50%)';
                
                // --- MEJORA: Información detallada en el cartel verde ---
                label.innerHTML = `
                    <strong>CLASE ACTIVA: ${index}</strong>
                    <div class="win-stat"><span>Confianza:</span> <span style="color:#fff">${(value*100).toFixed(1)}%</span></div>
                    <div class="win-stat"><span>Estado:</span> <span style="color:#0f0">DOMINANTE</span></div>
                `;
                // --------------------------------------------------------
            } else label.style.display='none';
        } else if(label) label.style.display='none';
    }
}