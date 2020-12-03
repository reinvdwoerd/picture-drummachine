let video, poseNet;

const $playbackSpeed = document.querySelector(".playback-speed");
const $playbackSpeedLabel = document.querySelector(".playback-speed-label");

const $midiOutputSelect = document.querySelector(".midi select.outputs");
const $joints = document.querySelector(".midi .joints");

const $currentTime = document.querySelector(".current-time");
const $currentFrame = document.querySelector(".current-frame");
const $poseData = document.querySelector(".pose-data");

let poses = [];

function setup() {
  let canvas = createCanvas(1920, 1080);
  canvas.parent("main");

  video = createVideo(
    "https://cdn.glitch.com/fce293e2-7c18-4790-a64f-62ef937bd855%2Fposepose.mp4?v=1606091227303"
  );

  video.volume(0);
  video.stop();
  video.loop();
  video.hide();
  video.size(1920, 1080);

  video.elt.onloadeddata = () => {
    poseNet = ml5.poseNet(video, () => {
      console.log("model ready");
    });

    // This sets up an event that fills the global variable "poses"
    // with an array every time new poses are detected
    poseNet.on("pose", results => {
      poses = results;
      // console.log(poses);

      for (const result of results) {
        const { pose } = result;

        for (const keypoint of pose.keypoints) {
          const { part, position } = keypoint;
          const joint = document.querySelector(
            `.joint[data-part="${keypoint.part}"]`
          );
          const x = position.x / video.width;
          const y = position.y / video.height;

          if (joint) {
            joint.querySelector(`.x`).innerText = Math.round(x * 128);
            joint.querySelector(`.progress-x`).value = Math.round(x * 128);
            joint.querySelector(`.y`).innerText = Math.round(y * 128);
            joint.querySelector(`.progress-y`).value = Math.round(y * 128);
          } else {
            $joints.innerHTML += `
              <div class="joint" data-part="${keypoint.part}">
                <div class="name">${keypoint.part}</div>

                <div class="grid">
                  <span class="label">x:</span>
                  <span class="x"></span>
                  <progress class="progress-x" min="0" max="128" value="70"></progress>
                  <button onclick="sendTest(${keypoint.part}, 1)">test</button>
                </div>

                <div class="grid">
                  <span class="label">y:</span>
                  <span class="y"></span>
                  <progress class="progress-y" min="0" max="128" value="70"></progress>
                  <button onclick="sendTest(${keypoint.part}, 2)">test</button>
                </div>
             </div>
            `;
          }
        }
      }
    });
  };

  frameRate(60);
}

function onPose() {}

let currentMidiOutput = null;

function draw() {
  image(video, 0, 0, video.width, video.height);
  console.log("draw...");
  // We can call both functions to draw all keypoints and the skeletons
  drawKeypoints();
  drawSkeleton();
}

// A function to draw ellipses over the detected keypoints
function drawKeypoints() {
  // Loop through all the poses detected
  for (let i = 0; i < poses.length; i++) {
    // For each pose detected, loop through all the keypoints
    let pose = poses[i].pose;
    for (let j = 0; j < pose.keypoints.length; j++) {
      // A keypoint is an object describing a body part (like rightArm or leftShoulder)
      let keypoint = pose.keypoints[j];
      // Only draw an ellipse is the pose probability is bigger than 0.2
      if (keypoint.score > 0.2) {
        noStroke();
        fill(255, 0, 0);
        ellipse(keypoint.position.x, keypoint.position.y, 10, 10);
      }
    }
  }
}

// A function to draw the skeletons
function drawSkeleton() {
  // Loop through all the skeletons detected
  for (let i = 0; i < poses.length; i++) {
    let skeleton = poses[i].skeleton;
    // For every skeleton, loop through all body connections
    for (let j = 0; j < skeleton.length; j++) {
      let partA = skeleton[j][0];
      let partB = skeleton[j][1];
      stroke(255, 0, 0);
      line(
        partA.position.x,
        partA.position.y,
        partB.position.x,
        partB.position.y
      );
    }
  }
}

// setInterval(() => {

// Get pose data
// const posesForCurrentTime = findClosestPoses($video.currentTime)
// $poseData.innerText = JSON.stringify(posesForCurrentTime[0])

// Send the midi
// if (!$video.paused) {
//     // Get pose data
//     const posesForCurrentTime = findClosestPoses($video.currentTime)
//     $poseData.innerText = JSON.stringify(posesForCurrentTime[0])

//     console.log(posesForCurrentTime[0].length)

//     for (let i = 0; i < posesForCurrentTime[0].length; i++) {
//       const [x, y] = posesForCurrentTime[0][i];
//       currentMidiOutput.sendControlChange(i, x * 128, 1)
//       currentMidiOutput.sendControlChange(i, y * 128, 2)

//     }
// }

// }, 16)


$playbackSpeed.oninput = () => {
  $video.playbackRate = $playbackSpeedLabel.innerText = $playbackSpeed.value;
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
