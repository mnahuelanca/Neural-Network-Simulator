import * as THREE from 'three';

export class UI {
    constructor(network, visualizer, appState, datasets) {
        this.network = network;
        this.visualizer = visualizer;
        this.appState = appState;
        this.datasets = datasets;

        this.raycaster = new THREE.Raycaster();
        this.raycaster.params.Line.threshold = 0.5;
        this.mouse = new THREE.Vector2(-100, -100);
        this.hoveredObj = null;

        this.decisionCanvas = document.getElementById('decisionBoundaryCanvas');
        if (this.decisionCanvas) {
            this.decisionCtx = this.decisionCanvas.getContext('2d', { willReadFrequently: true });
        }

        this.initCharts();
        this.initHoverGuides();
        this.initMouse();
    }

    initCharts() {
        const ctxLoss = document.getElementById('lossChart');
        const ctxOut = document.getElementById('outputChart');

        if (ctxLoss) {
            this.chartLoss = new Chart(ctxLoss, {
                type: 'line',
                data: { labels: [], datasets: [{ label: 'Loss', data: [], borderColor: '#ff0055', borderWidth: 2, pointRadius: 0, tension: 0.1 }] },
                options: { 
                    responsive: true, maintainAspectRatio: false, animation: false,
                    interaction: { mode: 'index', intersect: false },
                    scales: { 
                        x: { display: false }, 
                        y: { 
                            grid: { color: '#333' }, min: 0,
                            afterBuildTicks: (axis) => {
                                const el = document.getElementById('target-loss');
                                if(el) axis.ticks.push({ value: parseFloat(el.value), label: 'Meta' });
                            },
                            grid: {
                                color: ctx => (ctx.tick && ctx.tick.label === 'Meta') ? '#00ffff' : '#333',
                                borderDash: ctx => (ctx.tick && ctx.tick.label === 'Meta') ? [5, 5] : []
                            }
                        } 
                    },
                    plugins: { legend: { display: false }, tooltip: { enabled: false } }
                }
            });
        }

        if (ctxOut) {
            this.chartOut = new Chart(ctxOut, {
                type: 'bar',
                data: { labels: [], datasets: [{ label: 'Predicción', data: [], backgroundColor: '#00f3ff' }, { label: 'Meta Real', data: [], backgroundColor: 'rgba(255,255,255,0.2)' }] },
                options: { 
                    responsive: true, maintainAspectRatio: false, animation: { duration: 100 },
                    scales: { y: { max: 1, min: 0, grid: { color: '#333' } }, x: { ticks: { color: '#ccc' } } },
                    plugins: { legend: { display: false } }
                }
            });
        }
    }

    resetCharts() {
        if(this.chartLoss) {
             this.chartLoss.data.labels = [];
             this.chartLoss.data.datasets[0].data = [];
             this.chartLoss.update();
        }
    }

    drawDecisionBoundary() {
        // Opcional para futuro
        if (!this.decisionCanvas || !this.decisionCtx) return;
    }

    setGuide(text, color = '#ccc') {
        const box = document.getElementById('guide-text');
        if (box) {
            box.innerHTML = text;
            box.style.color = color;
            box.style.borderColor = (color === '#00f3ff' || color === '#00ff00') ? color : '#333';
        }
    }

    initHoverGuides() {
        const els = document.querySelectorAll('[data-desc]');
        els.forEach(el => {
            el.addEventListener('mouseenter', () => {
                 // Siempre mostramos la descripción del parámetro, incluso entrenando,
                 // porque ya quitamos la info redundante de entrenamiento.
                 this.setGuide(el.getAttribute('data-desc'), "#00f3ff");
            });
            el.addEventListener('mouseleave', () => {
                 // Mensaje por defecto al salir
                 this.setGuide("Configura la red o selecciona un nodo para ver detalles.", "#aaa");
            });
        });
    }

    initMouse() {
        window.addEventListener('mousemove', e => {
            this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
            this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
            
            const tooltip = document.getElementById('tooltip');
            if (tooltip) {
                tooltip.style.left = e.clientX + 'px';
                tooltip.style.top = e.clientY + 'px';
            }
        });
    }

    updateRaycast() {
        if (!this.visualizer || !this.visualizer.camera) return null;
        
        this.raycaster.setFromCamera(this.mouse, this.visualizer.camera);
        
        const objects = [];
        if (this.visualizer.neuronMeshes) objects.push(...this.visualizer.neuronMeshes);
        if (this.visualizer.connMeshes) objects.push(...this.visualizer.connMeshes.map(c => c.mesh));

        if (objects.length === 0) return null;

        const intersects = this.raycaster.intersectObjects(objects);
        const tooltip = document.getElementById('tooltip');

        if (intersects.length > 0) {
            this.hoveredObj = intersects[0].object;
            document.body.style.cursor = 'pointer';
            if (tooltip) tooltip.style.display = 'block';

            const data = this.hoveredObj.userData;
            if (data && tooltip) {
                if (data.type === 'neuron') {
                    if (this.network.neurons[data.l] && this.network.neurons[data.l][data.i]) {
                        const n = this.network.neurons[data.l][data.i];
                        tooltip.innerHTML = `<span style="color:#aaa">Neurona [Capa ${data.l} : ${data.i}]</span><br>
                                             <strong>Salida:</strong> <span style="color:#0f0">${n.value.toFixed(4)}</span><br>
                                             <strong>Bias:</strong> ${n.bias.toFixed(4)}`;
                    }
                } else {
                    const w = this.network.weights[data.l][data.from][data.to];
                    const color = w > 0 ? '#00f3ff' : '#ff0055';
                    tooltip.innerHTML = `<span style="color:#aaa">Conexión</span><br>
                                         <strong>Peso:</strong> <span style="color:${color}">${w.toFixed(4)}</span>`;
                }
            }
        } else {
            this.hoveredObj = null;
            document.body.style.cursor = 'default';
            if (tooltip) tooltip.style.display = 'none';
        }
        return this.hoveredObj;
    }

    updateStats(epoch, loss) {
        const elEpoch = document.getElementById('epoch-val');
        const elLoss = document.getElementById('loss-val');
        if (elEpoch) elEpoch.innerText = epoch;
        if (elLoss) elLoss.innerText = loss.toFixed(5);

        // CORRECCIÓN: Se eliminó la actualización de la caja de texto 'guide-text'
        // para evitar redundancia. Solo actualizamos los gráficos.

        if (epoch % 5 === 0 && this.chartLoss) {
            this.chartLoss.data.labels.push(epoch);
            this.chartLoss.data.datasets[0].data.push(loss);
            
            if (this.chartLoss.data.labels.length > 50) {
                this.chartLoss.data.labels.shift();
                this.chartLoss.data.datasets[0].data.shift();
            }
            
            const targetEl = document.getElementById('target-loss');
            const targetLoss = targetEl ? parseFloat(targetEl.value) : 0.001;
            const currentMax = Math.max(...this.chartLoss.data.datasets[0].data);
            
            const safeMax = isNaN(currentMax) ? 1 : currentMax;
            this.chartLoss.options.scales.y.max = Math.max(safeMax, targetLoss * 2);
            
            this.chartLoss.update();

            if (this.network.layers.length > 0 && this.chartOut) {
                const lastL = this.network.layers.length - 1;
                const lastNeurons = this.network.neurons[lastL];
                if (lastNeurons) {
                    this.chartOut.data.labels = lastNeurons.map((_, i) => `N${i}`);
                    this.chartOut.data.datasets[0].data = lastNeurons.map(n => n.value);
                    this.chartOut.update();
                }
            }
        }
    }
    
    updateTargets(targets) {
        if (this.chartOut) {
            this.chartOut.data.datasets[1].data = targets;
            this.chartOut.update();
        }
    }
}