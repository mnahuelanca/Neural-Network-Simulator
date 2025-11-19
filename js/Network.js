export class Network {
    constructor() {
        this.layers = []; this.neurons = []; this.weights = [];
        this.config = { learningRate: 0.1, hiddenActivation: 'ReLU', outputActivation: 'Sigmoid', inputNodes: 3, hiddenNodes: 5, outputNodes: 2 };
        this.loss = 0; this.iteration = 0;
    }
    init(config) {
        this.config = { ...this.config, ...config };
        this.layers = [this.config.inputNodes, this.config.hiddenNodes, this.config.outputNodes];
        this.neurons = []; this.weights = []; this.iteration = 0; this.loss = 1;
        
        this.layers.forEach(count => {
            let layerArr = [];
            for(let i=0; i<count; i++) layerArr.push({ value: 0, delta: 0, bias: (Math.random()*2-1)*0.1 });
            this.neurons.push(layerArr);
        });

        for(let l=0; l<this.layers.length-1; l++) {
            let wMatrix = [];
            for(let i=0; i<this.layers[l]; i++) {
                let row = [];
                for(let j=0; j<this.layers[l+1]; j++) row.push((Math.random()*2-1)*0.5);
                wMatrix.push(row);
            }
            this.weights.push(wMatrix);
        }
    }
    activate(x, func) {
        if(func==='Sigmoid') return 1/(1+Math.exp(-x));
        if(func==='Tanh') return Math.tanh(x);
        if(func==='ReLU') return Math.max(0,x);
        return x;
    }
    derivative(y, func) {
        if(func==='Sigmoid') return y*(1-y);
        if(func==='Tanh') return 1-(y*y);
        if(func==='ReLU') return y>0?1:0;
        return 1;
    }
    forward(inputs) {
        for(let i=0; i<this.layers[0]; i++) this.neurons[0][i].value = inputs[i]||0;
        for(let l=0; l<this.layers.length-1; l++) {
            const func = (l+1 === this.layers.length-1) ? this.config.outputActivation : this.config.hiddenActivation;
            for(let j=0; j<this.layers[l+1]; j++) {
                let sum = this.neurons[l+1][j].bias;
                for(let i=0; i<this.layers[l]; i++) sum += this.neurons[l][i].value * this.weights[l][i][j];
                this.neurons[l+1][j].value = this.activate(sum, func);
            }
        }
    }
    trainStep(inputs, targets) {
        this.forward(inputs);
        this.iteration++;
        const lr = this.config.learningRate;
        const lastL = this.layers.length-1;
        
        let sumErr = 0;
        for(let i=0; i<this.layers[lastL]; i++) {
            let t = targets[i] !== undefined ? targets[i] : 0;
            const out = this.neurons[lastL][i].value;
            const err = t - out;
            sumErr += err*err;
            this.neurons[lastL][i].delta = err * this.derivative(out, this.config.outputActivation);
        }
        this.loss = sumErr/this.layers[lastL];

        for(let l=lastL-1; l>=0; l--) {
            const func = this.config.hiddenActivation;
            for(let i=0; i<this.layers[l]; i++) {
                let errSum = 0;
                for(let j=0; j<this.layers[l+1]; j++) {
                    const d = this.neurons[l+1][j].delta;
                    if(!isNaN(d)) {
                        errSum += d * this.weights[l][i][j];
                        this.weights[l][i][j] += this.neurons[l][i].value * d * lr;
                    }
                }
                this.neurons[l][i].delta = errSum * this.derivative(this.neurons[l][i].value, func);
                this.neurons[l][i].bias += this.neurons[l][i].delta * lr * 0.1;
            }
        }
        if(isNaN(this.loss)) this.loss = 1;
    }
}