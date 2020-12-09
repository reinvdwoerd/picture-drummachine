/* global Vue, strokeWeight, stroke, frameRate, posenet, createVideo, lerp, loadFont, textFont, textSize, createCanvas, fill, ellipse, image, line, width, height, WebMidi, noStroke, text, rect, dist, mouseX, mouseY, map */


let video, net, currentMidiOutput, font;

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



const $ui = new Vue({
  el: '#posemidi',
  data: {
    // Poses, mappings, etc.
    lastPoses: [],
    poses: [],
    trackedItems: [],
    outputs: null,
    
    // Drag and drop connections
    draggingFromKeypoint: null,
    draggingFromPerson: null,
    
    
    videoDuration: 1,
    currentTime: 0,

    // Slider
    draggingSlider: false,
    wasPaused: false,
    playbackSpeed: 1
  },
  
  mounted() {
    // storage
    this.trackedItems = JSON.parse(localStorage.getItem('trackedItems')) || []
    this.videoDuration = video.elt.duration
  },
  
  methods: {
    searchIfOnAKeypoint()  {
      for (let i = 0; i < this.poses.length; i++) {
          const pose = this.poses[i];
          for (const keypoint of pose.keypoints) {
            const { position, part } = keypoint
            const { x, y } = position;

            // It's on a dot
            if (dist(x, y, mouseX, mouseY) < jointRadius) {
              return [i, keypoint]
            }
        }
      }
    },
    
    canvasMousePressed() {
      const result = $ui.searchIfOnAKeypoint()

      if (result) {
        $ui.draggingFromKeypoint = result[1]
        $ui.draggingFromPerson = result[0]
      } else {
        // It's on the background
        if (video.elt.paused) {
          video.loop();
        } else {
          video.pause();
        }
      }
    },
    
    canvasMouseReleased() {
      const result = $ui.searchIfOnAKeypoint()

      if (result) {
        $ui.draggingFromKeypoint = result[1]
        $ui.draggingFromPerson = result[0]
      } else {
        // It's on the background
        if (video.elt.paused) {
          video.loop();
        } else {
          video.pause();
        }
      }
    },
    
    onSpeedInput(e) {
      this.playbackSpeed = e.target.value;
      video.speed(e.target.value);
    },
    
    onPositionDown() {
      this.wasPaused = video.elt.paused;
    },
    
    onPositionInput(e) {
      video.pause();
      video.time(e.target.value);
      this.draggingSlider = true;
    },
    
    onPositionChange(e) {
      video.time(e.target.value);
      if (!this.wasPaused) video.elt.play();
      this.draggingSlider = false;
    }
  }
})


// Constants
const jointRadius = 20;
const textBoxPadding = 5;



async function setup() {
  // canvas
  let canvas = createCanvas(1920, 1080);
  canvas.parent("main");

  // font
  font = loadFont('https://cdn.glitch.com/d781fd93-be94-46a0-a508-c751384d9f8a%2FCourier%20New%20Regular.ttf?v=1607412096016')
  textFont(font)
  
  
  canvas.mousePressed(() => {
    $ui.canvasMousePressed()
  });
  
  
  canvas.mouseReleased(() => {
    $ui.canvasMouseReleased()
  })

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



// DRAW ===========================================
async function draw() {
  // THE UPDATING ---
  const currentTime = $ui.draggingSlider
    ? Number($positionSlider.value)
    : video.elt.currentTime;
  const currentFrame = Math.floor(currentTime * 29.97);
  $currentTime.innerText = `${currentTime.toPrecision(
    3
  )} / ${video.elt.duration.toPrecision(3)}s`;
  $currentFrame.innerText = currentFrame;

  if ($ui.draggingSlider) {
    image(video, 0, 0, width, height);
    return;
  } 

  try {
    // Video position
    if (!net || video.elt.readyState != 4) return;
    $ui.lastPoses = $ui.poses
    $ui.poses = await net.estimateMultiplePoses(video.elt, {
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
  $ui.poses = $ui.poses.sort(
    (a, b) => a.keypoints[0].position.x - b.keypoints[0].position.x
  );

  
  // SEND MIDI AND UPDATE UI =========================
  // =================================================
  for (let i = 0; i < $ui.trackedItems.length; i++) {
    const item = $ui.trackedItems[i];
    
    const midiI = i * 2;
      
    if (item.type == 'absolute') {
      
      if ($ui.poses[item.person]) {
          const keypoint = $ui.poses[item.person].keypoints.find(kp => kp.part == item.part)
          
          if ($ui.lastPoses[item.person]) {
            const lastKeypoint = $ui.lastPoses[item.person].keypoints.find(kp => kp.part == item.part)

            const changeX = clamp((keypoint.position.x - lastKeypoint.position.x) / video.width, 0, 1) 
            const changeY = clamp((keypoint.position.y - lastKeypoint.position.y) / video.height, 0, 1)
            const change = Math.abs(changeX + changeY) * 50

            item.velocity = Math.max(lerp(item.velocity, change, 0.4), 0.001)
          }
          
          
            const x = clamp(keypoint.position.x / video.width, 0, 1);
            const y = clamp(keypoint.position.y / video.height, 0, 1);

            if (currentMidiOutput && !video.elt.paused) {
              console.log('sent!!!')
              currentMidiOutput.sendControlChange(midiI, map(x, 0, 1, 0, 127), 1);
              currentMidiOutput.sendControlChange(midiI, map(y, 0, 1, 0, 127), 2);
              currentMidiOutput.sendControlChange(midiI + 1, clamp(map(item.velocity, 0, 1, 0, 127), 0, 127), 3);
            }

            $el.querySelector(`.x`).innerText = x.toPrecision(2);
            $el.querySelector(`.y`).innerText = y.toPrecision(2);
            $el.querySelector(`.velocity`).innerText = item.velocity.toPrecision(2) * 50;
            $el.classList.toggle('highlight', item.highlighted)
          } else {
              $joints.innerHTML += `
                  
              `;
          }
      }
    
    
    if (item.type == 'relative') {
      
      if ($ui.poses[item.personA] && $ui.poses[item.personB]) {
          const keypointA = $ui.poses[item.personA].keypoints.find(kp => kp.part == item.partA)
          const keypointB = $ui.poses[item.personB].keypoints.find(kp => kp.part == item.partB)
          // const distanceNow = dist(keypointA.position.x, keypointA.position.y, keypointB.position.x, keypointB.position.y)

            const x = clamp((keypointA.position.x - keypointB.position.x) / video.width, -1, 1);
            const y = clamp((keypointA.position.y - keypointB.position.y) / video.height, -1, 1);
            
            const distanceNow = Math.sqrt(x * x + y * y)
          
            if (isNaN(item.velocity)) item.velocity = 0
        
            const change = distanceNow - item.lastDistance        
      

            item.velocity = Math.max(lerp(item.velocity, change, 0.4), 0.001)
            item.lastDistance = distanceNow

            if (currentMidiOutput && !video.elt.paused) {
              currentMidiOutput.sendControlChange(midiI, map(x, -1, 1, 0, 127), 1);
              currentMidiOutput.sendControlChange(midiI, map(y, -1, 1, 0, 127), 2);
              currentMidiOutput.sendControlChange(midiI + 1, clamp(map(item.velocity, 0, 1, 0, 127), 0, 127), 1);
              currentMidiOutput.sendControlChange(midiI + 1, map(distanceNow, 0, 1, 0, 127), 2);
            }

            $el.querySelector(`.x`).innerText = x.toPrecision(2);
            $el.querySelector(`.y`).innerText = y.toPrecision(2);
            $el.querySelector(`.velocity`).innerText = item.velocity.toPrecision(1);
            $el.querySelector(`.length`).innerText = distanceNow.toPrecision(2);
            $el.classList.toggle('highlight', item.highlighted)
            
            $el.querySelector(`.x`).innerText = x.toPrecision(2);
            $el.querySelector(`.y`).innerText = y.toPrecision(2);
          }
    }
  }



  // THE DRAWING --------
  image(video, 0, 0, width, height);
  // We can call both functions to draw all keypoints and the skeleton
  drawSkeleton();
  drawKeypoints();
  
  if ($ui.draggingFromKeypoint) {
    stroke("#00ffff");
    line($ui.draggingFromKeypoint.position.x, $ui.draggingFromKeypoint.position.y, mouseX, mouseY);
  }
  
  for (const item of $ui.trackedItems) {
    if (item.type == 'relative' && $ui.poses[item.personA] && $ui.poses[item.personB]) {
        const keypointA = $ui.poses[item.personA].keypoints.find(kp => kp.part == item.partA)
        const keypointB = $ui.poses[item.personB].keypoints.find(kp => kp.part == item.partB)
        stroke("#00ffff");
        line(keypointA.position.x, keypointA.position.y, keypointB.position.x, keypointB.position.y);
        fill("#00ffff");
        ellipse(keypointA.position.x, keypointA.position.y, jointRadius);
        ellipse(keypointB.position.x, keypointB.position.y, jointRadius);
    }
  }
}

// A function to draw the skeletons
function drawSkeleton() {
  for (const pose of $ui.poses) {
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
  for (let i = 0; i < $ui.poses.length; i++) {
    const pose = $ui.poses[i];
    for (const keypoint of pose.keypoints) {
      const { position, part } = keypoint
      const { x, y } = position;
      
      const trackedItem = $ui.trackedItems.find(item => item.part == part && item.person == i)
      const mouseOver = dist(x, y, mouseX, mouseY) < jointRadius
      
      
      if (mouseOver || trackedItem) {
        fill("#00ffff");
        stroke("white");
        ellipse(x, y, jointRadius + 10);

        fill("black");
      } else {
        fill("white");
        stroke("black");
        ellipse(x, y, jointRadius);
      }
      
       if (mouseOver || ($ui.draggingFromKeypoint && $ui.draggingFromKeypoint.part == keypoint.part && i == $ui.draggingFromPerson)) {
          fill("black");
          noStroke()
          let bbox = font.textBounds(part, x, y, 30);
          rect(bbox.x - textBoxPadding, bbox.y - textBoxPadding, bbox.w + textBoxPadding * 2, bbox.h + textBoxPadding * 2);
          fill("white");
          text(part, x, y);  
      }
    }
  }
}

function setMapping(itemI, minOrMax, property, value) {
  $ui.trackedItems[itemI].mapping[property][minOrMax] = Number(value)
}

  
  
function deleteTrackedItem(i) {
  $ui.trackedItems.splice(i, 1)
  localStorage.setItem('trackedItems', JSON.stringify($ui.trackedItems))
}



// INPUT =======================================
// =============================================
// onscroll = () => {
//   const scrollRange = 300;
//   $("main").style.opacity = Math.max(
//     (scrollRange - scrollY) / scrollRange,
//     0.1
//   );
// };

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
  $ui.outputs = WebMidi.outputs
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
