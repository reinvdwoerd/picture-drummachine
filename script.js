const $video = document.querySelector('video')
const $playbackSpeed = document.querySelector('.playback-speed')
const $playbackSpeedLabel = document.querySelector('.playback-speed-label')

const $midiOutputSelect = document.querySelector('.midi select.outputs')

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
  let channelI = 0
  for (const [x, y] of posesForCurrentTime[0]) {
    // currentMidiOutput.playNote(Math.floor(x * 128), channelI)
    currentMidiOutput.sendControlChange(0, x * 128, channelI)
    currentMidiOutput.sendControlChange(0, y * 128, channelI + 1)

    channelI+=2;
  }
}, 16)



$playbackSpeed.oninput = () => {
  $video.playbackRate = $playbackSpeedLabel.innerText = $playbackSpeed.value
}


window.onload = () => {
  
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



// Add the list of outputs
WebMidi.enable(err => {
  console.log(err)
  
  for (const output of WebMidi.outputs) {
    $midiOutputSelect.innerHTML += `
      <option class="">${output.name}</option>
    `  
  }
  
  currentMidiOutput = WebMidi.outputs[0]
})