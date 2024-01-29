const viewPortWidth = window.innerWidth; // + 'px' en css
const viewPortHeight = window.innerHeight;
const cursor = document.querySelector('.cursor');
let timeout;

async function setup() {
    const patchExportURL = "export/patch.export.json";

    // Create AudioContext
    const WAContext = window.AudioContext || window.webkitAudioContext;
    const context = new WAContext();

    // Create gain node and connect it to audio output
    const outputNode = context.createGain();
    outputNode.connect(context.destination);

    // Fetch the exported patcher
    let response, patcher;
    try {
        response = await fetch(patchExportURL);
        patcher = await response.json();

        if (!window.RNBO) {
            // Load RNBO script dynamically
            // Note that you can skip this by knowing the RNBO version of your patch
            // beforehand and just include it using a <script> tag
            await loadRNBOScript(patcher.desc.meta.rnboversion);
        }

    } catch (err) {
        const errorContext = {
            error: err
        };
        if (response && (response.status >= 300 || response.status < 200)) {
            errorContext.header = `Couldn't load patcher export bundle`,
            errorContext.description = `Check app.js to see what file it's trying to load. Currently it's` +
            ` trying to load "${patchExportURL}". If that doesn't` +
            ` match the name of the file you exported from RNBO, modify` +
            ` patchExportURL in app.js.`;
        }
        if (typeof guardrails === "function") {
            guardrails(errorContext);
        } else {
            throw err;
        }
        return;
    }

    // (Optional) Fetch the dependencies
    let dependencies = [];
    try {
        const dependenciesResponse = await fetch("export/dependencies.json");
        dependencies = await dependenciesResponse.json();

        // Prepend "export" to any file dependenciies
        dependencies = dependencies.map(d => d.file ? Object.assign({}, d, { file: "export/" + d.file }) : d);
    } catch (e) {}

    // Create the device
    let device;
    try {
        device = await RNBO.createDevice({ context, patcher });
    } catch (err) {
        if (typeof guardrails === "function") {
            guardrails({ error: err });
        } else {
            throw err;
        }
        return;
    }

    // (Optional) Load the samples
    if (dependencies.length) {
        await device.loadDataBufferDependencies(dependencies);
    }

    // Connect the device to the web audio graph
    device.node.connect(outputNode);

    // (Optional) Automatically create sliders for the device parameters
    reachParams(device);

    // (Optional) Load presets, if any
    loadPresets(device, patcher);

    document.body.onclick = () => {
        context.resume();
    } // ------------------------------- ¿por esto necesita click?

    // Skip if you're not using guardrails.js
    if (typeof guardrails === "function") {
        guardrails();
    }
}

function loadRNBOScript(version) {
    return new Promise((resolve, reject) => {
        if (/^\d+\.\d+\.\d+-dev$/.test(version)) {
            throw new Error("Patcher exported with a Debug Version!\nPlease specify the correct RNBO version to use in the code.");
        }
        const el = document.createElement("script");
        el.src = "https://c74-public.nyc3.digitaloceanspaces.com/rnbo/" + encodeURIComponent(version) + "/rnbo.min.js";
        el.onload = resolve;
        el.onerror = function(err) {
            console.log(err);
            reject(new Error("Failed to load rnbo.js v" + version));
        };
        document.body.append(el);
    });
}

function reachParams(device) {
    let pdiv = document.getElementById("rnbo-parameter-sliders");
    let noParamLabel = document.getElementById("no-param-label");
    if (noParamLabel && device.numParameters > 0) pdiv.removeChild(noParamLabel);

    device.parameters.forEach(param => {
        document.addEventListener('pointermove', (e) => {
            let x = e.clientX;
            let y = e.clientY; // RECUERDA QUE GAIN ES DE 5VH

            let windowX = (100 * x) / viewPortWidth;
            let windowY = (100 * y) / viewPortHeight;

            if (param.id == 'window_client_x') {
                if (y >= (95 * viewPortHeight) / 100) {
                    console.log('out of range');
                } else {
                    param.value = windowX;
                }
            }
            if (param.id == 'window_client_y') {
                if (y >= (95 * viewPortHeight) / 100) {
                    console.log('out of range');
                } else {
                    param.value = windowY;
                }
            }

            cursor.style.top = y + 'px';
            cursor.style.left = x + 'px';
            // para que vuelva a aparecer
            cursor.style.display = 'block';
            // cursor effect on mouse stopped
            const mouseStopped = () => {
                cursor.style.display = 'none';
            }
            clearTimeout(timeout);
            timeout = setTimeout(mouseStopped, 1200);
        });
        document.addEventListener('pointerout', () => {
            cursor.style.display = 'none';
        });
    });
}

// como solo es uno, no importa si no se ve la función para seleccionar preset
function loadPresets(device, patcher) {
    let presets = patcher.presets || [];
    if (presets.length < 1) {
        document.getElementById("rnbo-presets").removeChild(document.getElementById("preset-select"));
        return;
    }

    document.getElementById("rnbo-presets").removeChild(document.getElementById("no-presets-label"));
    let presetSelect = document.getElementById("preset-select");
    presets.forEach((preset, index) => {
        const option = document.createElement("option");
        option.innerText = "▶";// preset.name;
        option.value = index;
        presetSelect.appendChild(option);
    });
    presetSelect.onchange = () => device.setPreset(presets[presetSelect.value].preset);
}
setup();

/*

const patcher = await fetch('patch.export.json');
const device = await RNBO.createDevice({
    patcher: patcher,
    context: webAudioContext
});

*/