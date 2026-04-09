import ModbusRTU from 'modbus-serial';

export default class Hm310 extends EventTarget {
    constructor(options) {
        super();

        this.options = Object.assign({
            baudRate: 9600,
            interval: 1000,
        }, options);

        this.connected = false;
        this.closed = false;
        this.client = new ModbusRTU();
        this.values = {};
        this.queue = [];
        this.listenerWrappers = new Map();

        // Prevent ERR_UNHANDLED_ERROR if no one is listening yet.
        this.on('error', () => {});

        this.client.connectRTUBuffered(this.options.port, {baudRate: this.options.baudRate}, error => {
            if (this.closed) {
                return;
            }

            if (error) {
                this.emitError(error);
                if (this.connected) {
                    this.connected = false;
                    this.emit('connected', false);
                }
            } else if (!this.connected) {
                this.connected = true;
                this.emit('connected', true);
            }

            this.read();
        });

        this.client.setID(1);
        this.client.setTimeout(1000);
    }

    emitError(error) {
        if (this.listenerCount('error') > 1) {
            this.emit('error', error);
        } else {
            console.error('Hm310 Error (no listeners):', error.message || error);
        }
    }

    close() {
        this.closed = true;
        this.removeAllListeners();
        this.on('error', () => {});

        try {
            return this.client.close(() => {});
        } catch (error) {
            console.error('Error closing Modbus client:', error);
        }
    }

    read() {
        if (this.closed) {
            return;
        }

        const newValues = {};

        this.enqueue(() => {
            if (this.closed) {
                return Promise.resolve();
            }

            const timestamp = Date.now();

            return this.client.readHoldingRegisters(0x00, 0x33)
                .then(r => Object.assign(newValues, {
                    powerSwitch: Boolean(r.data[0x01]),
                    protectStat: r.data[0x02],
                    overVoltageProtection: hasFlag(r.data[0x02], 1),
                    overCurrentProtection: hasFlag(r.data[0x02], 2),
                    overPowerProtection: hasFlag(r.data[0x02], 4),
                    overTemperatureProtection: hasFlag(r.data[0x02], 8),
                    shortCircuitProtection: hasFlag(r.data[0x02], 16),
                    model: r.data[0x03],
                    classDetail: r.data[0x04],
                    decimals: r.data[0x05],
                    decimalsVoltage: extractNibble(r.data[0x05], 8),
                    decimalsCurrent: extractNibble(r.data[0x05], 4),
                    decimalsPower: extractNibble(r.data[0x05], 0),
                    voltage: r.data[0x10] / 100,
                    current: r.data[0x11] / 1000,
                    power: combineRegisters(r.data[0x12], r.data[0x13]) / 1000,
                    powerCal: r.data[0x14],
                    protectVoltage: r.data[0x20] / 100,
                    protectCurrent: r.data[0x21] / 1000,
                    protectPower: r.data[0x22],
                    setVoltage: r.data[0x30] / 100,
                    setCurrent: r.data[0x31] / 1000,
                    setTimeSpan: r.data[0x32],
                }))
                .then(() => this.closed ? null : this.client.readHoldingRegisters(0x10_00, 0x05))
                .then(r => r && Object.assign(newValues, {
                    mVoltage: r.data[0x00],
                    mCurrent: r.data[0x01],
                    mTimeSpan: r.data[0x02],
                    mEnable: r.data[0x03],
                    mNextOffset: r.data[0x04],
                }))
                .then(() => this.closed ? null : this.client.readHoldingRegisters(0xC1_10, 0x20))
                .then(r => r && Object.assign(newValues, {
                    ul: r.data[0x00],
                    uh: r.data[0x0E],
                    il: r.data[0x10],
                    ih: r.data[0x1E],
                }))
                .then(() => this.closed ? null : this.client.readHoldingRegisters(0x88_00, 0x05))
                .then(r => r && Object.assign(newValues, {
                    powerStat: r.data[0x01],
                    defaultShow: r.data[0x02],
                    scp: r.data[0x03],
                    buzzer: r.data[0x04],
                }))
                .then(() => this.closed ? null : this.client.readHoldingRegisters(0x10_00, 0x54))
                .then(r => r && Object.assign(newValues, {
                    m1Voltage: r.data[0x00] / 100,
                    m1Current: r.data[0x01] / 1000,
                    m1Time: r.data[0x02],
                    m1Enable: Boolean(r.data[0x03]),
                    m2Voltage: r.data[0x10] / 100,
                    m2Current: r.data[0x11] / 1000,
                    m2Time: r.data[0x12],
                    m2Enable: Boolean(r.data[0x13]),
                    m3Voltage: r.data[0x20] / 100,
                    m3Current: r.data[0x21] / 1000,
                    m3Time: r.data[0x22],
                    m3Enable: Boolean(r.data[0x23]),
                    m4Voltage: r.data[0x30] / 100,
                    m4Current: r.data[0x31] / 1000,
                    m4Time: r.data[0x32],
                    m4Enable: Boolean(r.data[0x33]),
                    m5Voltage: r.data[0x40] / 100,
                    m5Current: r.data[0x41] / 1000,
                    m5Time: r.data[0x42],
                    m5Enable: Boolean(r.data[0x43]),
                    m6Voltage: r.data[0x50] / 100,
                    m6Current: r.data[0x51] / 1000,
                    m6Time: r.data[0x52],
                    m6Enable: Boolean(r.data[0x53]),
                }))
                .then(() => {
                    if (this.closed) {
                        return;
                    }

                    for (const key of Object.keys(newValues)) {
                        if (this.values[key] !== newValues[key]) {
                            this.values[key] = newValues[key];
                            this.emit('value', key, this.values[key], timestamp);
                        }
                    }
                });
        });
    }

    write(key, val) {
        if (this.closed) {
            return;
        }

        switch (key) {
            case 'powerSwitch': {
                this.enqueue(() => this.client.writeRegisters(0x01, [val ? 1 : 0]));
                break;
            }

            case 'protectVoltage': {
                this.enqueue(() => this.client.writeRegisters(0x20, [Math.round(val * 100)]));
                break;
            }

            case 'protectCurrent': {
                this.enqueue(() => this.client.writeRegisters(0x21, [Math.round(val * 1000)]));
                break;
            }

            case 'setVoltage': {
                this.enqueue(() => this.client.writeRegisters(0x30, [Math.round(val * 100)]));
                break;
            }

            case 'setCurrent': {
                this.enqueue(() => this.client.writeRegisters(0x31, [Math.round(val * 1000)]));
                break;
            }

            default: {
                const match = key.match(/^m(\d)(Current|Voltage)$/);
                if (match && match[2] === 'Voltage') {
                    const register = 0x10_00 + ((Number(match[1]) - 1) * 0x10);
                    return this.enqueue(() => this.client.writeRegisters(register, [Math.round(val * 100)]));
                }

                if (match && match[2] === 'Current') {
                    const register = 0x10_01 + ((Number(match[1]) - 1) * 0x10);
                    return this.enqueue(() => this.client.writeRegisters(register, [Math.round(val * 1000)]));
                }
            }
        }
    }

    enqueue(promise) {
        if (this.closed) {
            return;
        }

        this.queue.push(promise);
        this.dequeue();
    }

    dequeue() {
        if (this.closed || this.promisePending || this.queue.length === 0) {
            return;
        }

        this.promisePending = true;
        const promise = this.queue.shift();

        promise().then(() => {
            if (this.closed) {
                return;
            }

            if (!this.connected) {
                this.connected = true;
                this.emit('connected', true);
            }
        }).catch(error => {
            if (this.closed) {
                return;
            }

            this.emitError(error);
            if (this.connected) {
                this.connected = false;
                this.emit('connected', false);
            }
        }).finally(() => {
            if (this.closed) {
                return;
            }

            setTimeout(() => {
                this.promisePending = false;
                if (this.closed) {
                    return;
                }

                if (this.queue.length === 0) {
                    if (this.connected) {
                        this.read();
                    }
                } else {
                    this.dequeue();
                }
            }, 25);
        });
    }

    on(eventName, listener) {
        const wrappedListener = event => {
            const args = event instanceof CustomEvent ? event.detail : [];
            listener(...args);
        };

        if (!this.listenerWrappers.has(eventName)) {
            this.listenerWrappers.set(eventName, new Map());
        }

        this.listenerWrappers.get(eventName).set(listener, wrappedListener);
        this.addEventListener(eventName, wrappedListener);
        return this;
    }

    emit(eventName, ...args) {
        return this.dispatchEvent(new CustomEvent(eventName, {detail: args}));
    }

    listenerCount(eventName) {
        return this.listenerWrappers.get(eventName)?.size ?? 0;
    }

    removeAllListeners(eventName) {
        if (eventName) {
            removeWrappedListeners(this, eventName, this.listenerWrappers);
            return this;
        }

        for (const currentEventName of this.listenerWrappers.keys()) {
            removeWrappedListeners(this, currentEventName, this.listenerWrappers);
        }

        return this;
    }
}

function combineRegisters(highRegister, lowRegister) {
    return (highRegister * 65_536) + lowRegister;
}

function extractNibble(value, shift) {
    const divisor = 16 ** (shift / 4);
    return Math.trunc(value / divisor) % 16;
}

function hasFlag(value, flag) {
    return Math.trunc(value / flag) % 2 === 1;
}

function removeWrappedListeners(target, eventName, listenerWrappers) {
    const wrappedListeners = listenerWrappers.get(eventName);
    if (!wrappedListeners) {
        return;
    }

    for (const wrappedListener of wrappedListeners.values()) {
        target.removeEventListener(eventName, wrappedListener);
    }

    listenerWrappers.delete(eventName);
}
