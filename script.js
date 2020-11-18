const $video = document.querySelector('video')
const $playbackSpeed = document.querySelector('.playback-speed')
const $playbackSpeedLabel = document.querySelector('.playback-speed-label')

const $midiOutputSelect = document.querySelector('.midi select.outputs')
const $joints = document.querySelector('.midi .joints')

const $currentTime = document.querySelector('.current-time')
const $currentFrame = document.querySelector('.current-frame')
const $poseData = document.querySelector('.pose-data')


let currentMidiOutput = null


setInterval(() => {
  // Display time
  $currentTime.innerText = $video.currentTime
  $currentFrame.innerText = Math.floor($video.currentTime * 29.97)
  
  // Get pose data
  const posesForCurrentTime = findClosestPoses($video.currentTime)
  $poseData.innerText = JSON.stringify(posesForCurrentTime[0])
  
  // Send the midi
  if (!$video.paused) {
    // Display time
    $currentTime.innerText = $video.currentTime
    $currentFrame.innerText = Math.floor($video.currentTime * 29.97)

    // Get pose data
    const posesForCurrentTime = findClosestPoses($video.currentTime)
    $poseData.innerText = JSON.stringify(posesForCurrentTime[0])
    
    let channelI = 0
    console.log(posesForCurrentTime[0].length)
   
    for (const [x, y] of posesForCurrentTime[0]) {
      // currentMidiOutput.playNote(Math.floor(x * 128), channelI)
      currentMidiOutput.sendControlChange(0, x * 128, channelI)
      currentMidiOutput.sendControlChange(0, y * 128, channelI + 1)

      document.querySelector(`.joint[data-i="${channelI / 2}"] .x`).innerText = Math.round(x * 128)
      document.querySelector(`.joint[data-i="${channelI / 2}"] .progress-x`).value = Math.round(x * 128)

      document.querySelector(`.joint[data-i="${channelI / 2}"] .y`).innerText = Math.round(y * 128)
      document.querySelector(`.joint[data-i="${channelI / 2}"] .progress-y`).value = Math.round(y * 128)

      channelI+=2;
    }
  }
 
}, 16)



$playbackSpeed.oninput = () => {
  $video.playbackRate = $playbackSpeedLabel.innerText = $playbackSpeed.value
}


$midiOutputSelect.onchange = () => {
  currentMidiOutput = WebMidi.getOutputByName($midiOutputSelect.value)
  console.log("changed output to: ", currentMidiOutput.name)
}
  

function findClosestPoses(currentTime) {
  let minDifference = Number.MAX_VALUE
  let closestPoses = null
  
  for (const {time, poses, scores} of poseValues) {
    const difference = Math.abs(time - currentTime)
    
    // It's closer!
    if (difference < minDifference) {
      minDifference = difference
      closestPoses = poses
    }
  }
  
  return closestPoses
}



function sendTest(i) {
  
   currentMidiOutput.sendControlChange(0, 0, i)
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
  let channelI = 0
  for (let i = 0; i < 17; i++) {
    $joints.innerHTML += `
      <div class="joint" data-i="${i}">
        <div class="name">joint ${i + 1}</div>
        
        <div class="grid">
          <span class="label">x:</span>
          <span class="x"></span>
          <progress class="progress-x" min="0" max="128" value="70"></progress>
          <button onclick="sendTest(${channelI})">test</button>
        </div>

        <div class="grid">
          <span class="label">y:</span>
          <span class="y"></span>
          <progress class="progress-y" min="0" max="128" value="70"></progress>
          <button onclick="sendTest(${channelI + 1})">test</button>
        </div>
      </div>
    `
    
    channelI += 2
  }
})