// ThreeJS and Third-party deps
import * as THREE from "three";
import * as dat from "dat.gui";
import Stats from "three/examples/jsm/libs/stats.module";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { Color } from "three";

// Core boilerplate code deps
import {
  createCamera,
  createRenderer,
  runApp,
  getDefaultUniforms
} from "./core-utils";

global.THREE = THREE;

/**************************************************
 * 0. Tweakable parameters for the scene
 *************************************************/
const uniforms = {
  ...getDefaultUniforms(),
  u_pointsize: { value: 2.5 },
  // wave 1
  u_noise_freq_1: { value: 1.0 },
  u_noise_amp_1: { value: 1.0 },
  u_spd_modifier_1: { value: 1.0 },
  // wave 2
  u_noise_freq_2: { value: 1.0 },
  u_noise_amp_2: { value: 1.0 },
  u_spd_modifier_2: { value: 1.0 },
  u_wave_color: { value: new Color(120,140,50) }
};

/**************************************************
 * 1. Initialize core threejs components
 *************************************************/
// Create the scene
let scene = new THREE.Scene();

// Create the renderer via 'createRenderer',
// 1st param receives additional WebGLRenderer properties
// 2nd param receives a custom callback to further configure the renderer
let renderer = createRenderer({ antialias: true });

// Create the camera
// Pass in fov, near, far and camera position respectively
let camera = createCamera(45, 1, 100, { x: 0, y: 0, z: 4.5 });

/**************************************************
 * 2. Build your scene in this threejs app
 * This app object needs to consist of at least the async initScene() function (it is async so the animate function can wait for initScene() to finish before being called)
 * initScene() is called after a basic threejs environment has been set up, you can add objects/lighting to you scene in initScene()
 * if your app needs to animate things(i.e. not static), include a updateScene(interval, elapsed) function in the app as well
 *************************************************/
let app = {
  vertexShader() {
    return `
    #define PI 3.14159265359

    uniform float u_time;
    uniform float u_pointsize;
    uniform float u_noise_amp_1;
    uniform float u_noise_freq_1;
    uniform float u_spd_modifier_1;
    uniform float u_noise_amp_2;
    uniform float u_noise_freq_2;
    uniform float u_spd_modifier_2;

    // 2D Random
    float random (in vec2 st) {
        return fract(sin(dot(st.xy,
                            vec2(12.9898,78.233)))
                    * 43758.5453123);
    }

    // 2D Noise based on Morgan McGuire @morgan3d
    // https://www.shadertoy.com/view/4dS3Wd
    float noise (in vec2 st) {
        vec2 i = floor(st);
        vec2 f = fract(st);

        // Four corners in 2D of a tile
        float a = random(i);
        float b = random(i + vec2(1.0, 0.0));
        float c = random(i + vec2(0.0, 1.0));
        float d = random(i + vec2(1.0, 1.0));

        // Smooth Interpolation

        // Cubic Hermine Curve.  Same as SmoothStep()
        vec2 u = f*f*(3.0-2.0*f);
        // u = smoothstep(0.,1.,f);

        // Mix 4 coorners percentages
        return mix(a, b, u.x) +
                (c - a)* u.y * (1.0 - u.x) +
                (d - b) * u.x * u.y;
    }

    mat2 rotate2d(float angle){
        return mat2(cos(angle),-sin(angle),
                  sin(angle),cos(angle));
    }

    void main() {
      gl_PointSize = u_pointsize;

      vec3 pos = position;
      // pos.xy is the original 2D dimension of the plane coordinates
      pos.z += noise(pos.xy * u_noise_freq_1 + u_time * u_spd_modifier_1) * u_noise_amp_1;
      // add noise layering
      // minus u_time makes the second layer of wave goes the other direction
      pos.z += noise(rotate2d(PI / 4.) * pos.yx * u_noise_freq_2 - u_time * u_spd_modifier_2 * 0.6) * u_noise_amp_2;

      vec4 mvm = modelViewMatrix * vec4(pos, 1.0);
      gl_Position = projectionMatrix * mvm;
    }
    `;
  },
  fragmentShader() {
    return `
    #ifdef GL_ES
    precision mediump float;
    #endif

    #define PI 3.14159265359
    #define TWO_PI 6.28318530718
    
    uniform vec2 u_resolution;
    uniform vec3 u_wave_color; // Added uniform for wave color

    void main() {
      vec2 st = gl_FragCoord.xy/u_resolution.xy;
      vec3 normalizedColor = u_wave_color / 255.0;
      gl_FragColor = vec4(normalizedColor * vec3(st, 1.0 - st.y), 0.7
      );
    }
    `;
  },
  async initScene() {
    // OrbitControls
    this.controls = new OrbitControls(camera, renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.autoRotate = false;
    this.controls.autoRotateSpeed = 2.0;

    // Environment
    scene.background = new THREE.Color("#0d1214");

    // Mesh
    this.geometry = new THREE.PlaneGeometry(4, 4, 128, 128);
    const material = new THREE.ShaderMaterial({
      uniforms: uniforms,
      vertexShader: this.vertexShader(),
      fragmentShader: this.fragmentShader()
    });
    // Time
    this.time = {hours: {value: 0.0}, minutes: {value: 0.0}, seconds: {value: 0.0}};

    // const material = new THREE.MeshStandardMaterial();
    this.mesh = new THREE.Points(this.geometry, material);
    scene.add(this.mesh);

    // set appropriate positioning
    this.mesh.rotation.x = 3.1415 / -3;
    this.mesh.rotation.z = 3.1415 / 3;

    // GUI controls
    const gui = new dat.GUI();
    gui.domElement.classList.add("dg"); // Add class to GUI container

    gui.addColor(uniforms.u_wave_color, "value").name("Color");
    gui
      .add(uniforms.u_pointsize, "value", 1.0, 5.0, 0.5)
      .name("Density")
      .onChange((val) => {
        uniforms.u_pointsize.value = val;
      });

    // Create a button to toggle the visibility of the GUI
    const toggleGuiButton = document.createElement('button');
    toggleGuiButton.classList.add('toggle-gui-button');
    toggleGuiButton.innerHTML = '+';

    let isGuiVisible = false;

    toggleGuiButton.addEventListener('click', () => {
      isGuiVisible = !isGuiVisible;
      toggleGuiButton.innerHTML = isGuiVisible ? 'x' : '+';
      gui.domElement.style.display = isGuiVisible ? 'block' : 'none';
    });
    gui.domElement.querySelector('.close-button').style.display = 'none';
    // Append the button to the HTML body
    this.container.appendChild(toggleGuiButton);

    // Create a toggleable about section
    const aboutSection = document.createElement('div');
    aboutSection.classList.add('about-section');
    aboutSection.innerHTML = `
      <h1>About Wave Clock</h1>
      <p>Created by Anlon Zhu @ Princeton VIS218 </p>
      <p>'Wave Clock' is representation of time using a wave generated from noise particles. The speed, frequency, and amplitude of the waves are based on the current time's hours, minutes, and seconds, respectively.</p>
      <p>Requires WebGL and hardware acceleration enabled on browser.</p>
      <p>Created using Three.js and WebGL, based on wave noise work by <a href="https://github.com/franky-adl">franky-adl</a></p>
      `
    this.container.appendChild(aboutSection);

    // Toggle button for the about section
    const toggleAboutButton = document.createElement('button');
    toggleAboutButton.classList.add('toggle-about-button');
    toggleAboutButton.innerHTML = '?';

    let isAboutVisible = false;

    toggleAboutButton.addEventListener('click', () => {
      isAboutVisible = !isAboutVisible;
      toggleAboutButton.innerHTML = isAboutVisible ? 'x' : '?';
      // .style.display = isAboutVisible ? 'block' : 'none';
      aboutSection.style.display = isAboutVisible ? 'block' : 'none';
    });

    // Append the button to the HTML body
    this.container.appendChild(toggleAboutButton);
    
    this.stats1 = new Stats();

    // Clock
    const clockTimeElement = document.createElement("clockTime");
    clockTimeElement.classList.add("clockTime");
    clockTimeElement.textContent = "00:00:00";
    this.container.appendChild(clockTimeElement);

    const clockSeconds = document.createElement("clockSeconds");
    clockSeconds.classList.add("clockSeconds");
    clockSeconds.textContent = "00";
    this.container.appendChild(clockSeconds);

    // Toggle button for the about section
    const toggleTimeButton = document.createElement('button');
    toggleTimeButton.classList.add('toggle-time-button');
    toggleTimeButton.innerHTML = '<i class="fas fa-clock"></i>';

    let isTimeVisible = true;

    toggleTimeButton.addEventListener('click', () => {
      isTimeVisible = !isTimeVisible;
      toggleTimeButton.innerHTML = isTimeVisible ? '<i class="fas fa-clock"></i>' : '<i class="far fa-clock"></i>';
      clockTimeElement.style.display = isTimeVisible ? 'block' : 'none';
      clockSeconds.style.display = isTimeVisible ? 'block' : 'none';
    });

    // Append the button to the HTML body
    this.container.appendChild(toggleTimeButton);
    
  },

  // @param {number} hours - 12-hour format
  // @param {number} minutes - 0-59
  // @param {number} seconds - 0-59
  // @param {string} ampm - AM or PM
  formatTime(hours, minutes, seconds, ampm) {
    // set to two digits
    minutes = minutes.toString().padStart(2, "0");
    seconds = seconds.toString().padStart(2, "0");
    if (hours === 0) {
      hours = 12;
    }
    return `${hours}:${minutes} ${ampm}`;
  },
  // @param {number} interval - time elapsed between 2 frames
  // @param {number} elapsed - total time elapsed since app start
  updateScene(interval, elapsed) {
    this.controls.update();
    this.stats1.update();

     // Get the current time
    const date = new Date();
    const milliseconds = date.getMilliseconds();
    const seconds = date.getSeconds();
    const minutes = date.getMinutes();
    const hours = date.getHours() % 12;
    const ampm = date.getHours() >= 12 ? "PM" : "AM";

    // Fractional time for gradual shift
    const fractionalSeconds = seconds + milliseconds / 1000;
    const fractionalMinutes = minutes + fractionalSeconds / 60;
    const fractionalHours = hours + fractionalMinutes / 60;

    const MIDNIGHT = Math.PI * 0.5;
    let hourRotation = MIDNIGHT - Math.PI * 2 * (fractionalHours) / 12;
    let minuteRotation = MIDNIGHT - Math.PI * 2 * (fractionalMinutes) / 60;
    let secondRotation = MIDNIGHT - Math.PI * 2 * (fractionalSeconds) / 60;

    // Show time
    const clockTimeElement = document.querySelector(".clockTime");
    clockTimeElement.textContent = this.formatTime(hours, minutes, seconds, ampm);

    const clockSeconds = document.querySelector(".clockSeconds");
    clockSeconds.textContent = seconds.toString().padStart(2, "0");

    // Modify the amplitude, frequency, and speed based on time
    uniforms.u_noise_amp_1.value = 0.1 + Math.abs(Math.sin(secondRotation)) * 0.4; // Amplitude based on seconds
    uniforms.u_noise_amp_2.value = 0.1 + Math.abs(Math.sin(secondRotation)) * 0.4; // Amplitude based on seconds

    uniforms.u_noise_freq_1.value = 0.25 + Math.abs(Math.sin(minuteRotation)) * 2.5; // Frequency based on minutes
    uniforms.u_noise_freq_2.value = 0.25 + Math.abs(Math.sin(minuteRotation)) * 2.5; // Frequency based on minutes

    uniforms.u_spd_modifier_1.value = 0.3 + Math.abs(Math.sin(hourRotation)) * 1.5; // Speed based on hours
    uniforms.u_spd_modifier_2.value = 0.3 + Math.abs(Math.sin(hourRotation)) * 1.5; // Speed based on hours
  }
};

/**************************************************
 * 3. Run the app
 * 'runApp' will do most of the boilerplate setup code for you:
 * e.g. HTML container, window resize listener, mouse move/touch listener for shader uniforms, THREE.Clock() for animation
 * Executing this line puts everything together and runs the app
 * ps. if you don't use custom shaders, pass undefined to the 'uniforms'(2nd-last) param
 * ps. if you don't use post-processing, pass undefined to the 'composer'(last) param
 *************************************************/
runApp(app, scene, renderer, camera, true, uniforms, undefined);
