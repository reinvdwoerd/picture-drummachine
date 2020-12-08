/* global strokeWeight, stroke, frameRate, posenet, createVideo, createCanvas, fill, ellipse, image, line, width, height, WebMidi */
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

let poses = [];

async function setup() {
  let canvas = createCanvas(1920, 1080);
  canvas.parent("main");

  canvas.mousePressed(() => {
    if (video.elt.paused) {
      video.loop();
    } else {
      video.pause();
    }
  });

  // STYLE
  strokeWeight(5);
  stroke("white");

  // VIDEO
  const src =
    "https://cdn.glitch.com/5a74bc96-f3cf-4cb9-bf88-92a1bb8ca483%2Ffighting_encoded.mp4?v=1607391101408";
  video = createVideo(src);

  video.volume(0);
  video.stop();
  video.loop();
  video.showControls();
  video.hide();

  $positionSlider.setAttribute("max", video.elt.duration);

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
  const currentTime = video.elt.currentTime;
  const currentFrame = Math.floor(currentTime * 29.97);
  $currentTime.innerText = currentTime;
  $currentFrame.innerText = currentFrame;
  $positionSlider.value = currentTime;

  try {
    // Video position
    if (!net) return
    
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
  poses = poses.sort((a, b) => a.keypoints[0].position.x - b.keypoints[0].position.x)
  

  // KEYPOINTS =======================================
  // =================================================
  for (let poseI = 0; poseI < poses.length; poseI++) {
    const pose = poses[poseI];

    const $pose = $(`.pose[data-pose="${poseI}"]`);

    if ($pose) {
      for (let i = 0; i < pose.keypoints.length; i++) {
        // A keypoint is an object describing a body part (like rightArm or leftShoulder)
        const keypoint = pose.keypoints[i];
        const { part, position } = keypoint;

        const midiI = poseI * 16 + i;

        // Normalize values ----
        const x = clamp(position.x / video.width, 0, 1);
        const y = clamp(position.y / video.height, 0, 1);

        // MIDI OUT ------
        if (currentMidiOutput && !video.elt.paused) {
          currentMidiOutput.sendControlChange(midiI, x * 127, 1);
          currentMidiOutput.sendControlChange(midiI, y * 127, 2);
        }

        // DRAWING ----
        // Draw ellipses over the detected keypoints
        // Only draw an ellipse is the pose probability is bigger than 0.2
        if (keypoint.score > 0.2) {
          stroke("black");
          fill("white");
          ellipse(keypoint.position.x, keypoint.position.y, 20, 20);
        }

        // UI UPDATING -----
        const $joint = $pose.querySelector(
          `.joint[data-part="${keypoint.part}"]`
        );

        if ($joint) {
          // Update display
          $joint.querySelector(`.x`).innerText = x.toPrecision(2);
          $joint.querySelector(`.progress-x`).value = x.toPrecision(2);
          $joint.querySelector(`.y`).innerText = y.toPrecision(2);
          $joint.querySelector(`.progress-y`).value = y.toPrecision(2);
        } else {
          $pose.innerHTML += `
                  <div class="joint" data-part="${keypoint.part}" data-pose="${poseI}">
                    <div class="name">${keypoint.part}</div>

                    <div class="grid">
                      <span class="label">x:</span>
                      <span class="x"></span>
                      <progress class="progress-x" min="0" max="1" value="0"></progress>
                      <button onclick="sendTest(${midiI}, 1)">test</button>
                    </div>

                    <div class="grid">
                      <span class="label">y:</span>
                      <span class="y"></span>
                      <progress class="progress-y" min="0" max="1" value="0"></progress>
                      <button onclick="sendTest(${midiI}, 2)">test</button>
                    </div>
                 </div>
              `;
        }
      }
    } else {
      $joints.innerHTML += `
          <div class="pose" data-pose="${poseI}">
            <div class="name">
              PERSON ${poseI}
            </div>
          </div>
        `;
    }
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
  for (const pose of poses) {
    for (const keypoint of pose.keypoints) {
      stroke("black");
      fill("white");
      ellipse(keypoint.position.x, keypoint.position.y, 20, 20);
    }
  }
}

onscroll = () => {
  $('main').classList.toggle('half-transparent', scrollY > 300)
}

$playbackSpeed.oninput = () => {
  video.speed($playbackSpeed.value);
  $playbackSpeedLabel.innerText = $playbackSpeed.value;
};

$positionSlider.oninput = () => {
  video.elt.currentTime = video.elt.duration * $positionSlider.value;
};

$midiOutputSelect.onchange = () => {
  currentMidiOutput = WebMidi.getOutputByName($midiOutputSelect.value);
  console.log("changed output to: ", currentMidiOutput.name);
};

function sendTest(i, j) {
  currentMidiOutput.sendControlChange(i, 127, j);
}

WebMidi.enable(err => {
  console.log(err);

  // Add the list of outputs
  for (const output of WebMidi.outputs) {
    $midiOutputSelect.innerHTML += `
      <option class="">${output.name}</option>
    `;
  }

  currentMidiOutput = WebMidi.outputs[0];
});

// UTILITIES ===================================
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

  if (ev.dataTransfer.items) {
    // Use DataTransferItemList interface to access the file(s)
    for (var i = 0; i < ev.dataTransfer.items.length; i++) {
      // If dropped items aren't files, reject them
      if (ev.dataTransfer.items[i].kind === "file") {
        var file = ev.dataTransfer.items[i].getAsFile();
        console.log("... file[" + i + "].name = " + file.name);
      }
    }
  } else {
    // Use DataTransfer interface to access the file(s)
    console.log(ev.dataTransfer.files);
    for (var i = 0; i < ev.dataTransfer.files.length; i++) {
      console.log(
        "... file[" + i + "].name = " + ev.dataTransfer.files[i].name
      );
    }
  }
}

function dragOverHandler(ev) {
  console.log("File(s) in drop zone");
  // Prevent default behavior (Prevent file from being opened)
  ev.preventDefault();
}
