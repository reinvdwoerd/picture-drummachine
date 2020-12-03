const $video = document.querySelector('video')
const $playbackSpeed = document.querySelector('.playback-speed')
const $playbackSpeedLabel = document.querySelector('.playback-speed-label')

const $midiOutputSelect = document.querySelector('.midi select.outputs')
const $joints = document.querySelector('.midi .joints')

const $currentTime = document.querySelector('.current-time')
const $currentFrame = document.querySelector('.current-frame')
const $poseData = document.querySelector('.pose-data')


let currentMidiOutput = null

console.log($video)

$video.addEventListener('loadeddata', () => {
  const poseNet = ml5.poseNet($video, {detectionType: 'single'}, () => {
    console.log("model loaded")
  });
  
  poseNet.on("pose", results => {
    console.log("poses", results)
    
      if (!$video.paused) {
        
      }
  });
})





setInterval(() => {
  
  // Get pose data
  // const posesForCurrentTime = findClosestPoses($video.currentTime)
  // $poseData.innerText = JSON.stringify(posesForCurrentTime[0])
  
  // Send the midi
  if (!$video.paused) {
//     // Get pose data
//     const posesForCurrentTime = findClosestPoses($video.currentTime)
//     $poseData.innerText = JSON.stringify(posesForCurrentTime[0])
    
//     console.log(posesForCurrentTime[0].length)
    
    
//     for (let i = 0; i < posesForCurrentTime[0].length; i++) {
//       const [x, y] = posesForCurrentTime[0][i];
//       currentMidiOutput.sendControlChange(i, x * 128, 1)
//       currentMidiOutput.sendControlChange(i, y * 128, 2)

//       document.querySelector(`.joint[data-i="${i}"] .x`).innerText = Math.round(x * 128)
//       document.querySelector(`.joint[data-i="${i}"] .progress-x`).value = Math.round(x * 128)

//       document.querySelector(`.joint[data-i="${i}"] .y`).innerText = Math.round(y * 128)
//       document.querySelector(`.joint[data-i="${i}"] .progress-y`).value = Math.round(y * 128)
//     }
  }
 
}, 16)



$playbackSpeed.oninput = () => {
  $video.playbackRate = $playbackSpeedLabel.innerText = $playbackSpeed.value
}


$midiOutputSelect.onchange = () => {
  currentMidiOutput = WebMidi.getOutputByName($midiOutputSelect.value)
  console.log("changed output to: ", currentMidiOutput.name)
}
  

// function findClosestPoses(currentTime) {
//   let minDifference = Number.MAX_VALUE
//   let closestPoses = null
  
//   for (const {time, poses, scores} of poseValues) {
//     const difference = Math.abs(time - currentTime)
    
//     // It's closer!
//     if (difference < minDifference) {
//       minDifference = difference
//       closestPoses = poses
//     }
//   }
  
//   return closestPoses
// }



function sendTest(i, j) {
   currentMidiOutput.sendControlChange(i, 127, j)
}



WebMidi.enable(err => {
  console.log(err)
  
  // Add the list of outputs
  for (const output of WebMidi.outputs) {
    $midiOutputSelect.innerHTML += `
      <option class="">${output.name}</option>
    `  
  }
  
  currentMidiOutput = WebMidi.outputs[0]

  // Add the channels/joints
  for (let i = 0; i < 17; i++) {
    $joints.innerHTML += `
      <div class="joint" data-i="${i}">
        <div class="name">joint ${i + 1}</div>
        
        <div class="grid">
          <span class="label">x:</span>
          <span class="x"></span>
          <progress class="progress-x" min="0" max="128" value="70"></progress>
          <button onclick="sendTest(${i}, 1)">test</button>
        </div>

        <div class="grid">
          <span class="label">y:</span>
          <span class="y"></span>
          <progress class="progress-y" min="0" max="128" value="70"></progress>
          <button onclick="sendTest(${i}, 2)">test</button>
        </div>
      </div>
    `
 }
})