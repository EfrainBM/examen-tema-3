import * as THREE from 'https://cdn.skypack.dev/three@0.134.0/build/three.module.js';
import { OrbitControls } from 'https://cdn.skypack.dev/three@0.134.0/examples/jsm/controls/OrbitControls.js';
import { FBXLoader } from 'https://cdn.skypack.dev/three@0.134.0/examples/jsm/loaders/FBXLoader.js';
import Stats from 'https://cdn.skypack.dev/three@0.134.0/examples/jsm/libs/stats.module.js';  // Importar Stats
import { GUI } from 'https://cdn.skypack.dev/three@0.134.0/examples/jsm/libs/dat.gui.module.js';
import * as CANNON from 'https://cdn.jsdelivr.net/npm/cannon-es@0.19.0/dist/cannon-es.js';

let camera, controls, scene, renderer, stats, object, mixer;
let world;
const clock = new THREE.Clock();
const physicsObjects = [];
const assets = [
    'Breakdance 1990',
    'Breakdance Ending 1',
    'Running',
    'Caminar',
    'Correr',
    'Detenerse'
];
const params = {
    asset: 'Breakdance Ending 1'
};

init();

function init() {
    const container = document.createElement('div');
    document.body.appendChild(container);

    // Cámara
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 2000);
    camera.position.set(100, 200, 300);

    // Escena
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xadd8e6); // Color del fondo de la escena
    scene.fog = new THREE.Fog(0xadd8e6, 200, 1000); // Niebla

    // Luces
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.25); // Luz hemisférica
    hemiLight.position.set(0, 200, 0);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8); // Luz direccional
    dirLight.position.set(0, 200, 100);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.top = 1000;
    dirLight.shadow.camera.bottom = -1000;
    dirLight.shadow.camera.left = -1000;
    dirLight.shadow.camera.right = 1000;
    scene.add(dirLight);

    // Inicializar física
    initPhysics();

    // Suelo personalizado con cajas
    createCustomGround();

    // Ayudante de rejilla
    const grid = new THREE.GridHelper(1000, 20, 0x006400, 0x32CD32); // Ayudante de rejilla
    grid.material.opacity = 0.2;
    grid.material.transparent = false;
    scene.add(grid);

    // Renderizador
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // Controles de órbita
    controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 100, 0);
    controls.update();

    // Stats
    stats = new Stats();  // Instanciar Stats
    container.appendChild(stats.dom);

    // GUI
    const gui = new GUI();
    gui.add(params, 'asset', assets).onChange(function (value) {
        loadAsset(value);
    });

    // Cargar activo por defecto
    loadAsset(params.asset);

    // Escuchar eventos
    window.addEventListener('resize', onWindowResize);
    document.addEventListener('keydown', onKeyDown);

    // Iniciar el bucle de renderizado
    animate();
}

function initPhysics() {
    world = new CANNON.World();
    world.gravity.set(0, -20, -9); // Gravedad

    // Física del suelo
    const groundShape = new CANNON.Plane();
    const groundBody = new CANNON.Body({ mass: 0 });
    groundBody.addShape(groundShape);
    groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    world.addBody(groundBody);

    // Iterar sobre physicsObjects para añadir cada caja al mundo
    physicsObjects.forEach(obj => {
        const boxShape = new CANNON.Box(new CANNON.Vec3(25, 25, 25)); // halfExtents
        const boxBody = new CANNON.Body({ mass: 1 , shape: boxShape });
        boxBody.position.copy(obj.mesh.position);
        boxBody.quaternion.copy(obj.mesh.quaternion);
        world.addBody(boxBody);

        obj.body = boxBody; // Actualizar el objeto físico con la referencia al cuerpo
    });
}


function createCustomGround() {
    // Geometría para el suelo
    let floorGeometry = new THREE.PlaneGeometry(3000, 3000, 100, 100);
    floorGeometry.rotateX(-Math.PI / 2);

    // Aleatorizar posiciones de los vértices para variación
    let vertex = new THREE.Vector3();
    let position = floorGeometry.attributes.position;
    for (let i = 0; i < position.count; i++) {
        vertex.fromBufferAttribute(position, i);
        vertex.x += Math.random();
        vertex.y += Math.random();
        vertex.z += Math.random();
        position.setXYZ(i, vertex.x, vertex.y, vertex.z);
    }

    // Establecer colores de los vértices
    const colorsFloor = [];
    const color = new THREE.Color();
    for (let i = 0; i < position.count; i++) {
        color.setHSL(0.5 + Math.random() * 0.2, 0.75, 0.5 + Math.random() * 0.2);
        colorsFloor.push(color.r, color.g, color.b);
    }
    floorGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colorsFloor, 3));

    // Material para el suelo
    const floorMaterial = new THREE.MeshPhongMaterial({
        vertexColors: true,
        side: THREE.DoubleSide,
        flatShading: true,
        shininess: 0,
    });

    // Crear la malla del suelo
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.receiveShadow = true;
    scene.add(floor);

    // Geometría para las cajas
    const boxGeometry = new THREE.BoxGeometry(50, 50, 50).toNonIndexed();

    // Crear cajas aleatorias con colores diferentes
    for (let i = 0; i < 1000; i++) {
        const boxMaterial = new THREE.MeshPhongMaterial({
            color: new THREE.Color(Math.random(), Math.random(), Math.random()),
            flatShading: false,
        });

        const box = new THREE.Mesh(boxGeometry, boxMaterial);
        box.position.x = Math.random() * 3000 - 1500;
        box.position.y = Math.random() * 1000 + 10;
        box.position.z = Math.random() * 3000 - 1500;
        box.castShadow = true;
        scene.add(box);

        createBoxPhysics(box);
    }
}

function createBoxPhysics(boxMesh) {
    if (!world) {
        console.error('¡Mundo físico no inicializado!');
        return;
    }
    const boxShape = new CANNON.Box(new CANNON.Vec3(25, 25, 25)); // halfExtents
    const boxBody = new CANNON.Body({ mass: 1, shape: boxShape });
    boxBody.position.copy(boxMesh.position);
    boxBody.quaternion.copy(boxMesh.quaternion);
    world.addBody(boxBody);

    physicsObjects.push({ mesh: boxMesh, body: boxBody });
}


function loadAsset(asset) {
    const loader = new FBXLoader();
    loader.load('models/fbx/' + asset + '.fbx', function (group) {
        if (object) {
            scene.remove(object);
            object.traverse(function (child) {
                if (child.isMesh) {
                    child.material.dispose();
                    child.geometry.dispose();
                }
            });
        }
        object = group;
        mixer = new THREE.AnimationMixer(object);

        const action = mixer.clipAction(object.animations[0]);
        action.play();

        object.traverse(function (child) {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });

        scene.add(object);
        initPhysicsForCharacter(object);
    });
}

function initPhysicsForCharacter(characterObject) {
    const characterBox = new CANNON.Box(new CANNON.Vec3(45, 100, 45)); // Tamaño de colisión del personaje
    const characterBody = new CANNON.Body({ mass: 1, type: CANNON.Body.KINEMATIC });
    characterBody.addShape(characterBox);

    // Ajustar el centro de masa del personaje según sea necesario
    characterBody.position.copy(characterObject.position);
    characterBody.quaternion.copy(characterObject.quaternion);

    world.addBody(characterBody);

    physicsObjects.push({ mesh: characterObject, body: characterBody });
}





function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();
    if (mixer) {
        mixer.update(delta);
    }

    // Avanzar en el mundo físico
    world.step(1 / 60, delta, 3);

    // Actualizar posiciones de las mallas basado en la simulación física
    for (const obj of physicsObjects) {
        if (obj.body.type !== CANNON.Body.KINEMATIC) {
            obj.mesh.position.copy(obj.body.position);
            obj.mesh.quaternion.copy(obj.body.quaternion);
        } else {
            // Sincronizar la posición del cuerpo cinemático con la posición de la malla
            obj.body.position.copy(obj.mesh.position);
            obj.body.quaternion.copy(obj.mesh.quaternion);
        }
    }

    renderer.render(scene, camera);
    stats.update(); // Actualizar stats
}




function onKeyDown(event) {
    const moveDistance = 50;
    const moveDuration = 0.3;

    const cameraDirection = new THREE.Vector3();
    camera.getWorldDirection(cameraDirection);

    switch (event.code) {
        case 'KeyQ':
            loadAsset('Caminar');
            break;
        case 'KeyW':
            loadAsset('Correr');
            break;
        case 'KeyE':
            loadAsset('Detenerse');
            break;
        case 'KeyA':
            loadAsset('Breakdance 1990');
            break;
        case 'KeyS':
            loadAsset('Breakdance Ending 1');
            break;
        case 'KeyD':
            loadAsset('Running');
            break;
        case 'ArrowUp':
            moveCameraSmooth(cameraDirection.multiplyScalar(moveDistance), moveDuration);
            break;
        case 'ArrowDown':
            moveCameraSmooth(cameraDirection.multiplyScalar(-moveDistance), moveDuration);
            break;
        case 'ArrowLeft':
            moveCameraSmooth(new THREE.Vector3(cameraDirection.z, 0, -cameraDirection.x).multiplyScalar(moveDistance), moveDuration);
            break;
        case 'ArrowRight':
            moveCameraSmooth(new THREE.Vector3(-cameraDirection.z, 0, cameraDirection.x).multiplyScalar(moveDistance), moveDuration);
            break;
    }
}

function moveCameraSmooth(distance, duration) {
    const startPosition = camera.position.clone();
    const targetPosition = startPosition.clone().add(distance);

    const startTime = performance.now();

    function update() {
        const currentTime = performance.now();
        const elapsedTime = (currentTime - startTime) / 1000;

        if (elapsedTime < duration) {
            const t = elapsedTime / duration;
            camera.position.lerpVectors(startPosition, targetPosition, t);
            requestAnimationFrame(update);
        } else {
            camera.position.copy(targetPosition);
        }

        renderer.render(scene, camera);
    }

    update();
}

// Escuchar eventos
window.addEventListener('resize', onWindowResize);
document.addEventListener('keydown', onKeyDown);

// Iniciar el bucle de renderizado
animate();
