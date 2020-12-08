/* global strokeWeight, stroke, frameRate, posenet, createVideo, createCanvas, fill, ellipse, image, line, width, height, WebMidi, dist, mouseX, mouseY, map */
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


// Poses, mappings, data
let lastPoses = [];
let poses = [];
let trackedItems = []
let draggingFromKeypoint = null;
let draggingFromPerson = null;


// Slider
let draggingSlider = false;
let wasPaused = null;

// Constants
let jointRadius = 20;
let textBoxPadding = 5;



function searchIfOnAKeypoint()  {
  for (let i = 0; i < poses.length; i++) {
      const pose = poses[i];
      for (const keypoint of pose.keypoints) {
        const { position, part } = keypoint
        const { x, y } = position;

        // It's on a dot
        if (dist(x, y, mouseX, mouseY) < jointRadius) {
          return [i, keypoint]
        }
    }
  }
}


async function setup() {
  // canvas
  let canvas = createCanvas(1920, 1080);
  canvas.parent("main");

  // font
  font = loadFont('https://cdn.glitch.com/d781fd93-be94-46a0-a508-c751384d9f8a%2FCourier%20New%20Regular.ttf?v=1607412096016')
  textFont(font)
  
  // storage
  trackedItems = JSON.parse(localStorage.getItem('trackedItems')) || []
  
  canvas.mousePressed(() => {
    const result = searchIfOnAKeypoint()
    // console.log(result)

    if (result) {
      draggingFromKeypoint = result[1]
      draggingFromPerson = result[0]
    } else {
      // It's on the background
      if (video.elt.paused) {
        video.loop();
      } else {
        video.pause();
      }
    }
  });
  
  
  canvas.mouseReleased(() => {
    const result = searchIfOnAKeypoint()
    
    // console.log(result)

    if (result) {
      const [person, keypoint] = result
      if (keypoint.part == draggingFromKeypoint.part && person == draggingFromPerson) {
        trackedItems.push({
          person,
          part: keypoint.part,
          highlight: false,
          type: 'absolute', // or relative
          velocity: 0
        })
      } else {
        trackedItems.push({
          personA: draggingFromPerson,
          personB: person,
          partA: draggingFromKeypoint.part,
          partB: keypoint.part,
          highlight: false,
          type: 'relative', // or relative
          velocity: 0,
          lastDistance: 0,
          mapping: {
            x: [0, 1]
            x: [0, 1]
          x: [0, 1]
          }
        })
      }
      
  
      localStorage.setItem('trackedItems', JSON.stringify(trackedItems))
    }
    
    draggingFromKeypoint = null
    draggingFromPerson = null
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
    lastPoses = poses
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

  // SEND MIDI AND UPDATE UI =========================
  // =================================================
  for (let i = 0; i < trackedItems.length; i++) {
    const item = trackedItems[i];
    
    const midiI = i * 2;
      
    if (item.type == 'absolute') {
      let $el = $(`.tracked-item[data-part="${item.part}"][data-person="${item.person}"]`);
      
      if (poses[item.person]) {
          const keypoint = poses[item.person].keypoints.find(kp => kp.part == item.part)
          
          if (lastPoses[item.person]) {
            const lastKeypoint = lastPoses[item.person].keypoints.find(kp => kp.part == item.part)

            const changeX = clamp((keypoint.position.x - lastKeypoint.position.x) / video.width, 0, 1) 
            const changeY = clamp((keypoint.position.y - lastKeypoint.position.y) / video.height, 0, 1)
            const change = Math.abs(changeX + changeY) * 50

            item.velocity = Math.max(lerp(item.velocity, change, 0.4), 0.001)
          }
          
          
          if ($el) {
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
                  <div class="tracked-item absolute" data-part="${item.part}" data-person="${item.person}">
                    <div>
                      <span class="index">${i}</span>
                      <span class="name">PERSON ${item.person} <span class="sep">-</span> ${item.part}</span>
                      <button class="delete" onclick="deleteTrackedItem(${i})">x</button>
                    </div>

                    <div>
                      <span class="sep">x: </span>
                      <span class="x"></span> 
                      <span class="x"></span> 
                      <button class="test" onclick="sendTest(${midiI}, 1)">test</button>

                      <br>
                      <span class="sep">y: </span>
                      <span class="y"></span>
                      <button class="test" onclick="sendTest(${midiI}, 2)">test</button>
                      
                      <br>
                      <span class="sep">velocity: </span>
                      <span class="velocity"></span>
                      <button class="test" onclick="sendTest(${midiI + 1}, 3)">test</button>
                    </div>
                 </div>
              `;
          }
      }
    }
    
    
    if (item.type == 'relative') {
      let $el = $(`.tracked-item[data-part="${item.partA}-${item.partB}"]`);
      
      if (poses[item.personA] && poses[item.personB]) {
          const keypointA = poses[item.personA].keypoints.find(kp => kp.part == item.partA)
          const keypointB = poses[item.personB].keypoints.find(kp => kp.part == item.partB)
          // const distanceNow = dist(keypointA.position.x, keypointA.position.y, keypointB.position.x, keypointB.position.y)

            const x = clamp((keypointA.position.x - keypointB.position.x) / video.width, -1, 1);
            const y = clamp((keypointA.position.y - keypointB.position.y) / video.height, -1, 1);
            
                const distanceNow = Math.sqrt(x * x + y * y)
          
                if (isNaN(item.velocity)) item.velocity = 0
        
            const change = distanceNow - item.lastDistance        
      

            item.velocity = Math.max(lerp(item.velocity, change, 0.4), 0.001)
              
                item.lastDistance = distanceNow

            
            
          
          
          
          if ($el) {
            

            if (currentMidiOutput && !video.elt.paused) {
              currentMidiOutput.sendControlChange(midiI, map(x, -1, 1, 0, 127), 1);
              currentMidiOutput.sendControlChange(midiI, map(y, -1, 1, 0, 127), 2);
              currentMidiOutput.sendControlChange(midiI + 1, clamp(map(item.velocity * 100, 0, 1, 0, 127), 0, 127), 1);
              currentMidiOutput.sendControlChange(midiI + 1, map(distanceNow, 0, 1, 0, 127), 2);
            }

            $el.querySelector(`.x`).innerText = x.toPrecision(2);
            $el.querySelector(`.y`).innerText = y.toPrecision(2);
            $el.querySelector(`.velocity`).innerText = item.velocity.toPrecision(2) * 100;
            $el.querySelector(`.length`).innerText = distanceNow.toPrecision(2);
            $el.classList.toggle('highlight', item.highlighted)
          } else {
              let secondperson = item.personA == item.personB ? '' : `PERSON ${item.personB}<span class="sep">'s</span>` 
              $joints.innerHTML += `
                  <div class="tracked-item relative" data-part="${item.partA}-${item.partB}" data-person="${item.personA}-${item.personB}">
                    <div>
                      <span class="index">${i}</span>
                      <span class="name">PERSON ${item.personA}<span class="sep">'s</span> ${item.partA} <span class="sep">to</span> ${secondperson} ${item.partB}</span>
                      <button class="delete" onclick="deleteTrackedItem(${i})">x</button>
                    </div>

                    <div>
                      <span class="sep">x: </span>
                      <span class="x"></span>
                      <button class="test" onclick="sendTest(${midiI}, 1)">test</button>
                      <span>min: </span>
                      <span>max: </span>
  
  
                      <br>
                      <span class="sep">y: </span>
                      <span class="y"></span>
                      <button class="test" onclick="sendTest(${midiI}, 2)">test</button>
                      <span>min: </span>
                      <span>max: </span>
                      
                      <br>
                      <span class="sep">velocity: </span>
                      <span class="velocity"></span>
                      <button class="test" onclick="sendTest(${midiI + 1}, 1)">test</button>
                      <span>min: </span>
                      <span>max: </span>
                      
                      <br>
                      <span class="sep">length: </span>
                      <span class="length"></span>
                      <button class="test" onclick="sendTest(${midiI + 1}, 2)">test</button>
                      <span>min: </span>
                      <span>max: </span>
                   </div>
                 </div>
              `;
          }
        }
    }
  
      
    
  }


  
  
//   for (let poseI = 0; poseI < poses.length; poseI++) {
//     const pose = poses[poseI];

//     const $pose = $(`.pose[data-pose="${poseI}"]`);
    
//     if ($pose) {
//         let skeleton = posenet.getAdjacentKeyPoints(pose.keypoints);
//         skeleton.forEach(([partA, partB], i) => {
//           const midiI = poseI * 12 + i;

          
//         });
//     } else {
//       $joints.innerHTML += `
//           <div class="pose" data-pose="${poseI}" style="order: 17">
//             <div class="name">
//               <span>PERSON ${poseI}</span>
              
//               <span class="rel-x">rel. x</span>
//               <span class="rel-y">rel. y</span>
//               <span class="abs-x">abs. x</span>
//               <span class="abs-y">abs. y</span>
//             </div>
                         
            
//           </div>
//       `;
//     }
    
     // Normalize values ----
//         const x = clamp(position.x / video.width, 0, 1);
//         const y = clamp(position.y / video.height, 0, 1);

//         // MIDI OUT ------
//         if (currentMidiOutput && !video.elt.paused) {
//           currentMidiOutput.sendControlChange(midiI, x * 127, 1);
//           currentMidiOutput.sendControlChange(midiI, y * 127, 2);
//         }
    

  // console.log(frameRate())

  // THE DRAWING --------
  image(video, 0, 0, width, height);
  // We can call both functions to draw all keypoints and the skeleton
  drawSkeleton();
  drawKeypoints();
  
  if (draggingFromKeypoint) {
    stroke("#00ffff");
    line(draggingFromKeypoint.position.x, draggingFromKeypoint.position.y, mouseX, mouseY);
  }
  
  for (const item of trackedItems) {
    if (item.type == 'relative' && poses[item.personA] && poses[item.personB]) {
        const keypointA = poses[item.personA].keypoints.find(kp => kp.part == item.partA)
        const keypointB = poses[item.personB].keypoints.find(kp => kp.part == item.partB)
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
    for (const keypoint of pose.keypoints) {
      const { position, part } = keypoint
      const { x, y } = position;
      
      const trackedItem = trackedItems.find(item => item.part == part && item.person == i)
      const mouseOver = dist(x, y, mouseX, mouseY) < jointRadius
      
      
      if (mouseOver || trackedItem) {
        fill("#00ffff");
        stroke("white");
        ellipse(x, y, jointRadius + 10);

        fill("black");
        // stroke("white");
      } else {
        // if (trackedItem) {
        //   trackedItem.highlight = false;
        // }
        
        fill("white");
        stroke("black");
        ellipse(x, y, jointRadius);
      }
      
      
       if (mouseOver || (draggingFromKeypoint && draggingFromKeypoint.part == keypoint.part && i == draggingFromPerson)) {
          // if (trackedItem) {
          //     trackedItem.highlight = true;
          // } 
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


  
  
function deleteTrackedItem(i) {
  trackedItems.splice(i, 1)
  $(`.tracked-item:nth-child(${i + 1})`).remove()
  localStorage.setItem('trackedItems', JSON.stringify(trackedItems))
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

function lerp(v0, v1, t) {
    return v0*(1-t)+v1*t
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
