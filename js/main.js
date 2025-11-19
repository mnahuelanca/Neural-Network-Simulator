import { Network } from './Network.js';
import { Visualizer } from './Visualizer.js';
import { UI } from './UI.js';

const appState = {
    isTraining: false,
    inputs: [],
    targets: [],
    currentDataset: 'random'
};

const datasets = {
    'AND': [ { in: [0, 0], out: [0] }, { in: [0, 1], out: [0] }, { in: [1, 0], out: [0] }, { in: [1, 1], out: [1] } ],
    'OR':  [ { in: [0, 0], out: [0] }, { in: [0, 1], out: [1] }, { in: [1, 0], out: [1] }, { in: [1, 1], out: [1] } ],
    'XOR': [ { in: [0, 0], out: [0] }, { in: [0, 1], out: [1] }, { in: [1, 0], out: [1] }, { in: [1, 1], out: [0] } ],
    'RGB': [ 
        { in: [1, 0, 0], out: [1, 0, 0] }, { in: [0, 1, 0], out: [0, 1, 0] }, { in: [0, 0, 1], out: [0, 0, 1] },
        { in: [0.9, 0.1, 0.1], out: [1, 0, 0] }, { in: [0.1, 0.8, 0.1], out: [0, 1, 0] }, { in: [0.2, 0.2, 0.9], out: [0, 0, 1] },
        { in: [0, 0, 0], out: [0, 0, 0] }, { in: [1, 1, 1], out: [1, 1, 1] }
    ]
};

const activationExplanations = {
    'Sigmoid': "<strong>Sigmoid:</strong> (0 a 1). Clásica.",
    'Tanh': "<strong>Tanh:</strong> (-1 a 1). Centrada.",
    'ReLU': "<strong>ReLU:</strong> (0 a ∞). Eficiente.",
    'Linear': "<strong>Linear:</strong> Identidad."
};

const net = new Network();
const vis = new Visualizer('canvas-container', net);

// FIX: Pasar appState y datasets a la UI
const ui = new UI(net, vis, appState, datasets);

function init() {
    setupListeners();
    reset();
    loop();
}

function setupListeners() {
    const datasetSelect = document.getElementById('dataset-select');
    if (datasetSelect) {
        datasetSelect.addEventListener('change', (e) => {
            appState.currentDataset = e.target.value;
            if (appState.currentDataset === 'RGB') {
                document.getElementById('input-nodes').value = 3;
                document.getElementById('output-nodes').value = 3;
                ui.setGuide("Misión: Clasificar colores RGB.", "#00f3ff");
            } else if (appState.currentDataset !== 'random') {
                document.getElementById('input-nodes').value = 2;
                document.getElementById('output-nodes').value = 1;
                ui.setGuide(`Misión: Lógica <strong>${appState.currentDataset}</strong>.`, "#00f3ff");
            } else {
                ui.setGuide("Datos aleatorios.", "#fff");
            }
            reset();
        });
    }

    ['input-nodes', 'hidden-nodes', 'output-nodes'].forEach(id => {
        document.getElementById(id).addEventListener('input', () => reset());
    });

    ['act-hidden', 'act-output'].forEach(id => {
        document.getElementById(id).addEventListener('change', (e) => {
            ui.setGuide(activationExplanations[e.target.value], "#00f3ff");
            if (!appState.isTraining) {
                const params = getParams();
                net.config.hiddenActivation = params.hiddenActivation;
                net.config.outputActivation = params.outputActivation;
            }
        });
    });

    document.getElementById('btn-train').addEventListener('click', toggleTrain);
    document.getElementById('btn-reset').addEventListener('click', reset);
    document.getElementById('btn-step').addEventListener('click', () => {
        if (appState.isTraining) toggleTrain();
        trainOneEpoch();
        ui.setGuide("Paso manual.", "#00f3ff");
    });
}

function getParams() {
    return {
        inputNodes: parseInt(document.getElementById('input-nodes').value),
        hiddenNodes: parseInt(document.getElementById('hidden-nodes').value),
        outputNodes: parseInt(document.getElementById('output-nodes').value),
        learningRate: parseFloat(document.getElementById('lr-input').value),
        maxEpochs: parseInt(document.getElementById('max-epochs').value),
        targetLoss: parseFloat(document.getElementById('target-loss').value),
        hiddenActivation: document.getElementById('act-hidden').value,
        outputActivation: document.getElementById('act-output').value
    };
}

function reset() {
    appState.isTraining = false;
    const params = getParams();
    net.init(params);
    vis.rebuild();
    
    if (appState.currentDataset === 'random') {
        appState.inputs = Array(params.inputNodes).fill(0).map(() => Math.random());
        appState.targets = Array(params.outputNodes).fill(0).map(() => Math.round(Math.random()));
    } else {
        const data = datasets[appState.currentDataset];
        if(data) {
            appState.inputs = data[0].in;
            appState.targets = data[0].out;
        }
    }
    ui.updateTargets(appState.targets);
    ui.resetCharts();
    
    document.getElementById('acc-val').innerText = "0%";
    document.getElementById('acc-bar-fill').style.width = "0%";
    document.getElementById('btn-train').innerText = "▶ Entrenar";
    document.getElementById('btn-train').classList.remove('active');
    document.getElementById('status-val').innerText = "LISTO";
}

function toggleTrain() {
    appState.isTraining = !appState.isTraining;
    const btn = document.getElementById('btn-train');
    if(appState.isTraining) {
        btn.innerText = "⏸ Pausar";
        btn.classList.add('active');
        document.getElementById('status-val').innerText = "ENTRENANDO";
        document.getElementById('status-val').style.color = "#00ff00";
    } else {
        btn.innerText = "▶ Continuar";
        btn.classList.remove('active');
        document.getElementById('status-val').innerText = "PAUSADO";
        document.getElementById('status-val').style.color = "yellow";
    }
}

function trainOneEpoch() {
    const params = getParams();
    net.config.learningRate = params.learningRate; 

    if (appState.currentDataset === 'random') {
        const noisy = appState.inputs.map(v => Math.max(0, Math.min(1, v + (Math.random()-0.5)*0.05)));
        net.trainStep(noisy, appState.targets);
    } else {
        const data = datasets[appState.currentDataset];
        const sample = data[Math.floor(Math.random() * data.length)];
        net.trainStep(sample.in, sample.out);
        appState.inputs = sample.in;
        appState.targets = sample.out;
        ui.updateTargets(appState.targets);
    }

    if(net.iteration >= params.maxEpochs && appState.isTraining) toggleTrain();
    if(net.loss < params.targetLoss && appState.isTraining) toggleTrain();

    ui.updateStats(net.iteration, net.loss);
}

function calculateAccuracy() {
    if (appState.currentDataset === 'random') {
        const out = net.neurons[net.neurons.length-1].map(n=>n.value);
        if(appState.targets.length>0) return (Math.abs(out[0]-appState.targets[0])<0.5)?100:0;
        return 0;
    }
    const data = datasets[appState.currentDataset];
    let correct = 0;
    data.forEach(s => {
        net.forward(s.in);
        const out = net.neurons[net.neurons.length-1].map(n=>n.value);
        if (appState.currentDataset === 'RGB') {
             if(out.indexOf(Math.max(...out)) === s.out.indexOf(Math.max(...s.out))) correct++;
        } else {
             if(Math.abs(out[0] - s.out[0]) < 0.5) correct++;
        }
    });
    return (correct / data.length) * 100;
}

function loop() {
    requestAnimationFrame(loop);
    if(appState.isTraining) trainOneEpoch();

    if (net.iteration % 10 === 0) {
        const acc = calculateAccuracy();
        document.getElementById('acc-val').innerText = acc.toFixed(0) + "%";
        document.getElementById('acc-bar-fill').style.width = acc + "%";
        document.getElementById('acc-bar-fill').style.background = (acc===100) ? "#0f0" : "linear-gradient(90deg, #f05, #0ff)";
    }

    net.forward(appState.inputs); 
    vis.controls.update();
    const hovered = ui.updateRaycast();
    vis.updateVisuals(appState.targets, hovered, appState.isTraining);
}

init(); // Faltaba inicializar la app