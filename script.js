let video, poseNet, currentMidiOutput;

const $playbackSpeed = document.querySelector(".playback-speed");
const $playbackSpeedLabel = document.querySelector(".playback-speed-label");
const $positionSlider = document.querySelector(".position");
const $cachingProgress = document.querySelector("#caching");

const $midiOutputSelect = document.querySelector(".midi select.outputs");
const $joints = document.querySelector(".midi .joints");

const $currentTime = document.querySelector(".current-time");
const $currentFrame = document.querySelector(".current-frame");
const $poseData = document.querySelector(".pose-data");

let pose = null;
let posesByFrameCache = {};

let savedCache = false



let saved


async function setup() {
  let canvas = createCanvas(1920, 1080);
  canvas.parent("main");
  
  // STYLE
  strokeWeight(5);
  stroke("white");

  // VIDEO
  const src = "https://cdn.glitch.com/fce293e2-7c18-4790-a64f-62ef937bd855%2Fposepose.mp4?v=1606091227303"
  video = createVideo(src);
  
  
  let previousCache = localStorage.getItem(src)
  if (previousCache) {
    posesByFrameCache = JSON.parse(previousCache)
    updateCacheProgress()
  }
  

  video.volume(0);
  video.stop();
  video.loop();
  video.showControls();
  video.hide();

  video.elt.onloadeddata = async () => {
    const net = await posenet.load({
        // architecture: 'ResNet50',
    });
    
    $cachingProgress.setAttribute('max', video.elt.duration * 29.97)

    setInterval(async () => {
      try {
        // Video position
        const currentTime = video.elt.currentTime;
        const currentFrame = Math.floor(currentTime * 29.97);
        $currentTime.innerText = currentTime;
        $currentFrame.innerText = currentFrame;

        // Cache hit!
        if (posesByFrameCache[currentFrame]) {
          console.log("Cache hit! Current frame is: ", currentFrame)
          pose = posesByFrameCache[currentFrame]
          
        // Cache miss!
        } else {
          console.log("Cache miss: ", currentFrame)
          pose = await net.estimateSinglePose(video.elt, {
            flipHorizontal: false
          }); 
          posesByFrameCache[currentFrame] = pose;
          updateCacheProgress()
        }
      } catch (e) {
        return
      }
      
      
      for (let i = 0; i < pose.keypoints.length; i++) {
        // A keypoint is an object describing a body part (like rightArm or leftShoulder)
        const keypoint = pose.keypoints[i];
        const { part, position } = keypoint;

        const joint = document.querySelector(
          `.joint[data-part="${keypoint.part}"]`
        );
        const x = clamp(position.x / video.width, 0, 1);
        const y = clamp(position.y / video.height, 0, 1);

        // console.log(x, y)

        if (currentMidiOutput) {
          currentMidiOutput.sendControlChange(i, x * 127, 1);
          currentMidiOutput.sendControlChange(i, y * 127, 2);
        }

        if (joint) {
          joint.querySelector(`.x`).innerText = x.toPrecision(2);
          joint.querySelector(`.progress-x`).value = x.toPrecision(2);
          joint.querySelector(`.y`).innerText = y.toPrecision(2);
          joint.querySelector(`.progress-y`).value = y.toPrecision(2);
        } else {
          $joints.innerHTML += `
              <div class="joint" data-part="${keypoint.part}">
                <div class="name">${keypoint.part}</div>

                <div class="grid">
                  <span class="label">x:</span>
                  <span class="x"></span>
                  <progress class="progress-x" min="0" max="1" value="0"></progress>
                  <button onclick="sendTest(${i}, 1)">test</button>
                </div>

                <div class="grid">
                  <span class="label">y:</span>
                  <span class="y"></span>
                  <progress class="progress-y" min="0" max="1" value="0"></progress>
                  <button onclick="sendTest(${i}, 2)">test</button>
                </div>
             </div>
            `;
        }
      }
    }, 8);
  };

  frameRate(60);
}


function updateCacheProgress() {
  let framesCached = Object.keys(posesByFrameCache).length
  $cachingProgress.value = framesCached
}

setInterval(() => {
  console.log("--SAVING CACHE--")
  localStorage.setItem(video.elt.currentSrc, JSON.stringify(posesByFrameCache))
  savedCache = true
}, 10000)

function draw() {
  image(video, 0, 0, width, height);
  // console.log("draw...");
  // We can call both functions to draw all keypoints and the skeletons
  drawKeypoints();
  drawSkeleton();
}

// A function to draw ellipses over the detected keypoints
function drawKeypoints() {
  if (pose) {
    for (let j = 0; j < pose.keypoints.length; j++) {
      // A keypoint is an object describing a body part (like rightArm or leftShoulder)
      let keypoint = pose.keypoints[j];
      // Only draw an ellipse is the pose probability is bigger than 0.2
      if (keypoint.score > 0.2) {
        stroke("black");
        fill("white");
        ellipse(keypoint.position.x, keypoint.position.y, 20, 20);
      }
    }
  }
}

// A function to draw the skeletons
function drawSkeleton() {
  if (pose) {
    // Loop through all the skeletons detected
    let skeleton = posenet.getAdjacentKeyPoints(pose.keypoints)
    // For every skeleton, loop through all body connections
    for (let j = 0; j < skeleton.length; j++) {
      let partA = skeleton[j][0];
      let partB = skeleton[j][1];
      stroke('white')
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

function clamp(num, min, max) {
  return num <= min ? min : num >= max ? max : num;
}
