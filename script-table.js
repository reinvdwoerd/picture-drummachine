/* global strokeWeight, stroke, frameRate, posenet, createVideo, createCanvas, fill, ellipse, image, line, width, height, WebMidi, dist, mouseX, mouseY */
let video, net, currentMidiOutput;

const $ = selector => document.querySelector(selector);

const $playbackSpeed = $(".playback-speed");
const $playbackSpeedLabel = $(".playback-speed-label span");
const $positionSlider = $(".position");
const $cachingProgress = $("#caching");

const $midiOutputSelect = $(".midi select.outputs");
const $joints = $(".midi .joints");

const $currentTime = $(".current-time span");
const $currentFrame = $(".current-frame span");
const $poseData = $(".pose-data");


// Poses, mappings, data
let lastPoses = [];
let poses = [];
let trackedJoints = [[], [], [], [], []]

// Slider
let draggingSlider = false;
let wasPaused = null;

// Constants
let jointRadius = 20;




async function setup() {
  let canvas = createCanvas(1920, 1080);
  canvas.parent("main");

  canvas.mousePressed(() => {
    // It's on a dot
    for (let i = 0; i < poses.length; i++) {
      const pose = poses[i];
      for (const { position, part } of pose.keypoints) {
        const { x, y } = position;

        if (dist(x, y, mouseX, mouseY) < jointRadius) {
          trackedJoints[i].push(part)
          return;
        }
      }
    }

    // It's on the background
    if (video.elt.paused) {
      video.loop();
    } else {
      video.pause();
    }
  });

  // STYLE
  strokeWeight(5);
  stroke("white");
  textSize(30);

  // VIDEO
  const src =
    "https://cdn.glitch.com/5a74bc96-f3cf-4cb9-bf88-92a1bb8ca483%2Ffighting_encoded.mp4?v=1607391101408";
  video = createVideo(src);

  video.volume(0);
  video.stop();
  video.loop();
  video.showControls();
  video.hide();

  net = await posenet.load({
    // architecture: 'ResNet50',
    inputResolution: { width: 640, height: 480 },
    quantBytes: 4
  });

  video.elt.onloadeddata = async () => {
    video.loop();
  };

  frameRate(30);
}

async function draw() {
  // THE UPDATING ---
  const currentTime = draggingSlider
    ? Number($positionSlider.value)
    : video.elt.currentTime;
  const currentFrame = Math.floor(currentTime * 29.97);
  $currentTime.innerText = `${currentTime.toPrecision(
    3
  )} / ${video.elt.duration.toPrecision(3)}s`;
  $currentFrame.innerText = currentFrame;

  // console.log(draggingSlider)

  if (draggingSlider) {
    image(video, 0, 0, width, height);
    return;
  } else {
    $positionSlider.value = currentTime;
    $positionSlider.setAttribute("max", video.elt.duration);
  }

  try {
    // Video position
    if (!net || video.elt.readyState != 4) return;

    poses = await net.estimateMultiplePoses(video.elt, {
      flipHorizontal: false,
      maxDetections: 2,
      scoreThreshold: 0.75,
      nmsRadius: 20
    });
  } catch (e) {
    console.log(e);
    return;
  }

  // ORDER POSES BY NOSE POSITION =======================
  // This maintains the left/right poses ================
  poses = poses.sort(
    (a, b) => a.keypoints[0].position.x - b.keypoints[0].position.x
  );

  // KEYPOINTS =======================================
  // =================================================
  for (let poseI = 0; poseI < poses.length; poseI++) {
    const pose = poses[poseI];

    const $pose = $(`.pose[data-pose="${poseI}"]`);
    
    if ($pose) {
        let skeleton = posenet.getAdjacentKeyPoints(pose.keypoints);
        skeleton.forEach(([partA, partB], i) => {
          const midiI = poseI * 12 + i;

          let $el = $pose.querySelector(`.joint[data-part="${partA.part}-${partB.part}"]`);
          
          if ($el) {
            const x = clamp((partA.position.x - partB.position.x) / video.width, -1, 1);
            const y = clamp((partA.position.y - partB.position.y) / video.height, -1, 1);

            if (currentMidiOutput && !video.elt.paused) {
              currentMidiOutput.sendControlChange(poseI * 17 + 17, map(x, -1, 1, 0, 127), 1);
              currentMidiOutput.sendControlChange(poseI * 17 + 17, map(y, -1, 1, 0, 127), 2);
            }
            
            $el.querySelector(`.rel-x`).innerText = x.toPrecision(2);
            $el.querySelector(`.rel-y`).innerText = y.toPrecision(2);
            
          } else {
              $pose.innerHTML += `
                  <div class="joint" data-part="${partA.part}-${partB.part}" data-pose="${poseI}">
                    <span class="index">${midiI}</span>

                    <span class="part-a">${partA.part}</span>
                    <span class="sep">-</span>
                    <span class="part-b">${partB.part}</span>
       
                    <span class="rel-x"></span>
                    <span class="rel-y"></span>
                    <span class="abs-x">-</span>
                    <span class="abs-y">-</span>
                 </div>
              `;
          }
        });
    } else {
      $joints.innerHTML += `
          <div class="pose" data-pose="${poseI}" style="order: 17">
            <div class="name">
              <span>PERSON ${poseI}</span>
              
              <span class="rel-x">rel. x</span>
              <span class="rel-y">rel. y</span>
              <span class="abs-x">abs. x</span>
              <span class="abs-y">abs. y</span>
            </div>
                         
            
          </div>
      `;
    }
    
     // Normalize values ----
//         const x = clamp(position.x / video.width, 0, 1);
//         const y = clamp(position.y / video.height, 0, 1);

//         // MIDI OUT ------
//         if (currentMidiOutput && !video.elt.paused) {
//           currentMidiOutput.sendControlChange(midiI, x * 127, 1);
//           currentMidiOutput.sendControlChange(midiI, y * 127, 2);
//         }

    
      for (let i = 0; i < pose.keypoints.length; i++) {
        // A keypoint is an object describing a body part (like rightArm or leftShoulder)
        const keypoint = pose.keypoints[i];
        const { part, position } = keypoint;

        const midiI = poseI * 17 + i;

       

        // UI UPDATING -----
        //         const $joint = 

        //         if ($joint) {
        //           // Update display
        //           $joint.querySelector(`.x`).innerText = $joint.querySelector(`.progress-x`).value = x.toPrecision(2);
        //           $joint.querySelector(`.y`).innerText = $joint.querySelector(`.progress-y`).value = y.toPrecision(2);
        //         } else {

        //         }
      }

      // Update the additional joints ---- FIXME!!!
      //       const $joint = $pose.querySelector(`.joint[data-part="leftwrist-to-leftshoulder"]`);
//             
    
  }

  // console.log(frameRate())

  // THE DRAWING --------
  image(video, 0, 0, width, height);
  // We can call both functions to draw all keypoints and the skeleton
  drawSkeleton();
  drawKeypoints();
}

// A function to draw the skeletons
function drawSkeleton() {
  for (const pose of poses) {
    // Loop through all the skeletons detected
    let skeleton = posenet.getAdjacentKeyPoints(pose.keypoints);
    // For every skeleton, loop through all body connections
    for (const [partA, partB] of skeleton) {
      stroke("white");
      line(
        partA.position.x,
        partA.position.y,
        partB.position.x,
        partB.position.y
      );
    }
  }
}

// A function to draw ellipses over the detected keypoints
function drawKeypoints() {
  for (let i = 0; i < poses.length; i++) {
    const pose = poses[i];
    for (const { position, part } of pose.keypoints) {
      const { x, y } = position;

      if (dist(x, y, mouseX, mouseY) < jointRadius) {
        fill("#00ffff");
        stroke("white");
        ellipse(x, y, jointRadius + 10);

        fill("black");
        stroke("white");
        text(part, x, y);
      } else {
        fill("white");
        stroke("black");
        ellipse(x, y, jointRadius);
      }
    }
  }
}

onscroll = () => {
  const scrollRange = 300;
  $("main").style.opacity = Math.max(
    (scrollRange - scrollY) / scrollRange,
    0.1
  );
};

// INPUT =======================================
// =============================================
$playbackSpeed.oninput = () => {
  video.speed($playbackSpeed.value);
  $playbackSpeedLabel.innerText = $playbackSpeed.value;
};

$positionSlider.onmousedown = () => {
  wasPaused = video.elt.paused;
};

$positionSlider.oninput = () => {
  video.pause();
  video.time($positionSlider.value);
  draggingSlider = true;
};

$positionSlider.onchange = () => {
  video.time($positionSlider.value);
  if (!wasPaused) video.elt.play();
  draggingSlider = false;
};

$midiOutputSelect.onchange = () => {
  currentMidiOutput = WebMidi.getOutputByName($midiOutputSelect.value);
  console.log("changed output to: ", currentMidiOutput.name);
};

function togglePlaying() {
  if (video.elt.paused) {
    video.loop();
  } else {
    video.pause();
  }
}

// MIDI ========================================
// =============================================
function sendTest(i, j) {
  currentMidiOutput.sendControlChange(i, 127, j);
}

WebMidi.enable(err => {
  if (err) console.log(err);

  // Add the list of outputs
  for (const output of WebMidi.outputs) {
    $midiOutputSelect.innerHTML += `
      <option class="">${output.name}</option>
    `;
  }

  currentMidiOutput = WebMidi.outputs[0];
});

// UTILITIES =======================================
// =================================================
function clamp(num, min, max) {
  return num <= min ? min : num >= max ? max : num;
}

// DRAG AND DROP ===================================
// =================================================
function dropHandler(ev) {
  console.log("File(s) dropped");

  // Prevent default behavior (Prevent file from being opened)
  ev.preventDefault();

  console.log(ev.dataTransfer.files);

  // Load the new video and save the URL
  video.elt.src = URL.createObjectURL(ev.dataTransfer.files[0]);
  $positionSlider.setAttribute("max", video.elt.duration);
  localStorage.setItem("videoSrc", video.elt.src);
}

function dragOverHandler(ev) {
  console.log("File(s) in drop zone");
  // Prevent default behavior (Prevent file from being opened)
  ev.preventDefault();
}
