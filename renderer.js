const ipc = globalThis.electron.ipcRenderer;

const $ = globalThis.jQuery;
const Highcharts = globalThis.Highcharts;

Highcharts.setOptions({
    time: {
        useUTC: false,
    },
});

let gaugeZoom = true;

const voltageGauge = Highcharts.chart('voltageGauge', {
    chart: {
        type: 'gauge',
        backgroundColor: '#222',
        plotBackgroundColor: '#222',
        plotBackgroundImage: null,
        height: 150,
    },
    credits: {enabled: false},
    title: {text: ''},
    pane: [{
        startAngle: -45,
        endAngle: 45,
        background: null,
        center: ['50%', '145%'],
        size: 300,
    }],
    exporting: {enabled: false},
    tooltip: {enabled: false},
    yAxis: [{
        min: 0,
        max: 32,
        lineColor: '#888',
        lineWidth: 2,
        minorTickInterval: 'auto',
        minorTickPosition: 'outside',
        minorTickColor: '#888',
        minorTickLength: 6,
        minorTickWidth: 1,
        tickPosition: 'outside',
        tickColor: '#888',
        tickLength: 10,
        tickWidth: 2,
        labels: {
            rotation: 'auto',
            distance: 20,
            style: {color: '#fff'},
        },
        plotBands: [{
            from: 0, to: 32, color: 'red', id: 'plotband-voltage',
        }],
        pane: 0,
        title: {text: 'V', y: -40},
    }],
    plotOptions: {
        gauge: {
            dataLabels: {enabled: false},
            dial: {backgroundColor: '#fff', radius: '100%'},
        },
    },
    series: [{name: 'Voltage', data: [0], yAxis: 0}],
});

const currentGauge = Highcharts.chart('currentGauge', {
    chart: {
        type: 'gauge',
        backgroundColor: '#222',
        plotBackgroundColor: '#222',
        plotBackgroundImage: null,
        height: 150,
    },
    credits: {enabled: false},
    title: {text: ''},
    pane: [{
        startAngle: -45,
        endAngle: 45,
        background: null,
        center: ['50%', '145%'],
        size: 300,
    }],
    exporting: {enabled: false},
    tooltip: {enabled: false},
    yAxis: [{
        min: 0,
        max: 10,
        lineColor: '#888',
        lineWidth: 2,
        minorTickInterval: 'auto',
        minorTickPosition: 'outside',
        minorTickColor: '#888',
        minorTickLength: 6,
        minorTickWidth: 1,
        tickPosition: 'outside',
        tickColor: '#888',
        tickLength: 10,
        tickWidth: 2,
        labels: {
            rotation: 'auto',
            distance: 20,
            style: {color: '#fff'},
        },
        plotBands: [{
            from: 0, to: 10, color: 'red', id: 'plotband-current',
        }],
        pane: 0,
        title: {text: 'A', style: {color: '#fff'}, y: -40},
    }],
    plotOptions: {
        gauge: {
            dataLabels: {enabled: false},
            dial: {backgroundColor: '#fff', radius: '100%'},
        },
    },
    series: [{name: 'Current', data: [0], yAxis: 0}],
});

const powerGauge = Highcharts.chart('powerGauge', {
    chart: {
        type: 'gauge',
        backgroundColor: '#222',
        plotBackgroundColor: '#222',
        plotBackgroundImage: null,
        height: 150,
    },
    credits: {enabled: false},
    title: {text: ''},
    pane: [{
        startAngle: -45,
        endAngle: 45,
        background: null,
        center: ['50%', '145%'],
        size: 300,
    }],
    exporting: {enabled: false},
    tooltip: {enabled: false},
    yAxis: [{
        min: 0,
        max: 300,
        lineColor: '#888',
        lineWidth: 2,
        minorTickInterval: 'auto',
        minorTickPosition: 'outside',
        minorTickColor: '#888',
        minorTickLength: 6,
        minorTickWidth: 1,
        tickPosition: 'outside',
        tickColor: '#888',
        tickLength: 10,
        tickWidth: 2,
        labels: {
            rotation: 'auto',
            distance: 20,
            style: {color: '#fff'},
        },
        plotBands: [],
        pane: 0,
        title: {text: 'W', style: {color: '#fff'}, y: -40},
    }],
    plotOptions: {
        gauge: {
            dataLabels: {enabled: false},
            dial: {backgroundColor: '#fff', radius: '100%'},
        },
    },
    series: [{name: 'Power', data: [0], yAxis: 0}],
});

const chart = Highcharts.chart('chart', {
    chart: {
        type: 'line',
        backgroundColor: '#222',
        plotBackgroundColor: '#222',
        plotBackgroundImage: null,
        height: 230,
    },
    credits: {enabled: true},
    title: {text: ''},
    legend: {
        align: 'right',
        verticalAlign: 'top',
        layout: 'vertical',
        x: 0,
        y: 30,
        backgroundColor: '#222',
        itemHiddenStyle: {color: '#666'},
        itemMarginTop: 6,
    },
    plotOptions: {
        series: {
            step: 'left',
            marker: {symbol: 'circle'},
        },
    },
    xAxis: {type: 'datetime'},
    yAxis: {title: {text: ''}},
    series: [
        {data: [], name: 'Voltage [V]'},
        {data: [], name: 'Current [A]'},
        {data: [], name: 'Power [W]'},
        {data: [], name: 'SetVoltage [V]'},
        {data: [], name: 'SetCurrent [A]'},
    ],
});

const values = {
    voltage: 0,
    current: 0,
    power: 0,
    setVoltage: 0,
    setCurrent: 0,
    decimalsVoltage: 2,
    decimalsCurrent: 3,
    decimalsPower: 3,
    powerSwitch: false,
};

for (const elem of document.querySelectorAll('.write')) {
    elem.addEventListener('change', event => {
        if (event.target.type === 'checkbox') {
            ipc.send('write', {key: event.target.id, val: event.target.checked});
        } else {
            ipc.send('write', {key: event.target.id, val: event.target.value});
        }
    });
}

$('#powerSwitch').click(() => {
    ipc.send('write', {key: 'powerSwitch', val: !values.powerSwitch});
});

ipc.on('csv', async () => {
    ipc.send('show-save-dialog');
});

ipc.on('export-confirmed', filePath => {
    ipc.send('export', filePath);
});

ipc.on('connected', data => {
    if (data) {
        const alertNode = document.querySelector('#alert');
        if (alertNode) {
            if (globalThis.bootstrap && globalThis.bootstrap.Alert) {
                const bsAlert = globalThis.bootstrap.Alert.getOrCreateInstance(alertNode);
                bsAlert.close();
            } else {
                alertNode.remove();
            }
        }
    }
});

ipc.on('error', error => {
    const alertText = document.querySelector('#alertText');
    if (alertText) {
        alertText.innerHTML = '<strong>Error:</strong> ' + error;
    } else {
        const alertDiv = document.createElement('div');
        alertDiv.id = 'alert';
        alertDiv.className = 'alert alert-danger alert-dismissible fade show';
        alertDiv.setAttribute('role', 'alert');
        alertDiv.innerHTML = `
            <span id="alertText"><strong>Error:</strong> ${error}</span>
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        `;
        document.body.prepend(alertDiv);
    }
});

const seriesLookup = {
    voltage: 0,
    current: 1,
    power: 2,
    setVoltage: 3,
    setCurrent: 4,
};

function addPoint(series, val) {
    const now = Date.now();
    const data = [now, val];
    chart.series[seriesLookup[series]].addPoint(data, true, false);
}

function updateLargeDigits() {
    const dVoltage = document.querySelector('#dVoltage');
    const dCurrent = document.querySelector('#dCurrent');
    const dPower = document.querySelector('#dPower');

    if (values.powerSwitch) {
        if (dVoltage) {
            dVoltage.innerHTML = (Number(values.voltage) || 0).toFixed(values.decimalsVoltage || 2);
        }

        if (dCurrent) {
            dCurrent.innerHTML = (Number(values.current) || 0).toFixed(values.decimalsCurrent || 3);
        }

        if (dPower) {
            dPower.innerHTML = (Number(values.power) || 0).toFixed(values.decimalsPower || 3);
        }
    } else {
        if (dVoltage) {
            dVoltage.innerHTML = (Number(values.setVoltage) || 0).toFixed(values.decimalsVoltage || 2);
        }

        if (dCurrent) {
            dCurrent.innerHTML = (Number(values.setCurrent) || 0).toFixed(values.decimalsCurrent || 3);
        }

        if (dPower) {
            dPower.innerHTML = 'OFF';
        }
    }
}

ipc.on('values', data => {
    values[data.key] = data.val;

    let updateElems = true;

    switch (data.key) {
        case 'voltage': {
            handleVoltageValue(data.val);
            break;
        }

        case 'current': {
            handleCurrentValue(data.val);
            break;
        }

        case 'power': {
            handlePowerValue(data.val);
            break;
        }

        case 'setVoltage': {
            handleSetVoltageValue(data.val);
            break;
        }

        case 'setCurrent': {
            handleSetCurrentValue(data.val);
            break;
        }

        case 'overVoltageProtection': {
            toggleBadge('#ovp', data.val);
            updateElems = false;
            break;
        }

        case 'overCurrentProtection': {
            toggleBadge('#ocp', data.val);
            updateElems = false;
            break;
        }

        case 'overPowerProtection': {
            toggleBadge('#opp', data.val);
            break;
        }

        case 'overTemperatureProtection': {
            toggleBadge('#otp', data.val);
            break;
        }

        case 'shortCircuitProtection': {
            toggleBadge('#scp', data.val);
            updateElems = false;
            break;
        }

        case 'powerSwitch': {
            updatePowerSwitch(data.val);
            updateElems = false;
            break;
        }

        default:
    }

    if (updateElems) {
        const elem = document.querySelector(`#${data.key}`);
        if (elem) {
            if (elem.tagName === 'INPUT') {
                elem.value = data.val;
            } else {
                elem.innerHTML = data.val;
            }
        }
    }

    updateLargeDigits();
});

function handleVoltageValue(value) {
    voltageGauge.series[0].points[0].update(value);
    voltageGauge.redraw();
    updateModes();
    addPoint('voltage', value);
}

function handleCurrentValue(value) {
    currentGauge.series[0].points[0].update(value);
    currentGauge.redraw();
    updateModes();
    addPoint('current', value);
}

function handlePowerValue(value) {
    powerGauge.series[0].points[0].update(value);
    powerGauge.redraw();
    addPoint('power', value);
}

function handleSetVoltageValue(value) {
    voltageGauge.yAxis[0].removePlotBand('plotband-voltage');
    voltageGauge.yAxis[0].addPlotBand({
        from: value,
        to: gaugeZoom ? Math.ceil(values.setVoltage) : 32,
        color: 'red',
        id: 'plotband-voltage',
    });
    voltageGauge.redraw();
    updateModes();
    updateZoom();
    addPoint('setVoltage', value);
}

function handleSetCurrentValue(value) {
    currentGauge.yAxis[0].removePlotBand('plotband-current');
    currentGauge.yAxis[0].addPlotBand({
        from: value,
        to: gaugeZoom ? Math.ceil(values.setCurrent * 1.1) : 10,
        color: 'red',
        id: 'plotband-current',
    });
    currentGauge.redraw();
    updateModes();
    updateZoom();
    addPoint('setCurrent', value);
}

function toggleBadge(selector, isVisible) {
    if (isVisible) {
        $(selector).show();
    } else {
        $(selector).hide();
    }
}

function updatePowerSwitch(isEnabled) {
    if (isEnabled) {
        $('#powerSwitch').addClass('btn-success').removeClass('btn-secondary');
    } else {
        $('#powerSwitch').addClass('btn-secondary').removeClass('btn-success');
    }
}

function updateModes() {
    $('#cv').css('background-color', values.voltage === values.setVoltage ? '#00bc8c' : '#444');
    $('#cc').css('background-color', (values.voltage < values.setVoltage) && (values.current >= values.setCurrent) ? '#E74C3C' : '#444');
}

function updateZoom() {
    voltageGauge.yAxis[0].update({max: gaugeZoom ? Math.ceil(values.setVoltage) : 32});
    voltageGauge.yAxis[0].removePlotBand('plotband-voltage');
    voltageGauge.yAxis[0].addPlotBand({
        from: values.setVoltage,
        to: gaugeZoom ? Math.ceil(values.setVoltage) : 32,
        color: 'red',
        id: 'plotband-voltage',
    });
    voltageGauge.redraw();

    currentGauge.yAxis[0].update({max: gaugeZoom ? Math.ceil(values.setCurrent * 1.1) : 10});
    currentGauge.yAxis[0].removePlotBand('plotband-current');
    currentGauge.yAxis[0].addPlotBand({
        from: values.setCurrent,
        to: gaugeZoom ? Math.ceil(values.setCurrent * 1.1) : 10,
        color: 'red',
        id: 'plotband-current',
    });
    currentGauge.redraw();

    powerGauge.yAxis[0].update({max: gaugeZoom ? (Math.ceil(values.setCurrent * values.setVoltage) || 300) : 300});
}

ipc.send('refresh', {});

$('#voltageGauge, #currentGauge, #powerGauge').click(() => {
    gaugeZoom = !gaugeZoom;
    updateZoom();
});

$('.memory').click(function () {
    const id = $(this).attr('id');
    const voltage = $('#' + id + 'Voltage').val();
    const current = $('#' + id + 'Current').val();
    $('#setVoltage').val(voltage);
    ipc.send('write', {key: 'setVoltage', val: voltage});
    $('#setCurrent').val(current);
    ipc.send('write', {key: 'setCurrent', val: current});
});

$('.container').show();
