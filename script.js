let images = {}
let popup = {}

let dragSourceIndex = null


let WIDTH = screen.width
let HEIGHT = screen.height
let NUMPADS = 127


async function setup() {
	let canvas = createCanvas(WIDTH, HEIGHT);
	canvas.parent("main")
	background(0)
	noLoop()

	canvas.elt.onclick = () => {
		canvas.elt.requestFullscreen()
	}
}

const $ui = new Vue({
	el: '#posemidi',
	data: {
		inputs: null,
		padsDropRange: null,
		pads: [],
		currentMidiInput: null,
		size: 10
	},

	async mounted() {
		// Try to restore all the pads from indexedDB
		for (let i = 0; i < NUMPADS; i++) {
			let restored = await idbKeyval.get(`image-${i}`);
			this.pads.push({
				image: restored,
				justTriggered: false
			})

			if (restored) {
				images[i] = loadImage(restored)
			}
		}
	},

	methods: {
		onMidiInputChange(e) {
			currentMidiInput = WebMidi.getInputByName(e.target.value);
			console.log("changed output to: ", currentMidiInput.name);
			localStorage.setItem('midiInput', currentMidiInput.name)
		},

		dragStartHandler(i) {
			dragSourceIndex = i
		},

		dragOverHandler(i, ev) {
			ev.preventDefault();

			// console.log([i, i + ev.dataTransfer.files.length]);

			this.padsDropRange = [i, i + ev.dataTransfer.files.length]

		},

		dropHandler(i, ev) {
			ev.preventDefault();
			console.log("Dropped", ev);


			const items = Array.from(ev.dataTransfer.items)
				.filter(item => item.type == "text/html" || item.kind == "file")


			/**
			 * It's from another pad
			 */
			if (dragSourceIndex !== null) {
				// Assign source pad to target pad
				this.pads[i] = this.pads[dragSourceIndex]
				images[i] = loadImage(this.pads[dragSourceIndex].image)
				idbKeyval.set(`image-${i}`, this.pads[dragSourceIndex].image);

				// Clear source pad
				this.pads[dragSourceIndex] = { ...this.pads[dragSourceIndex], image: null }
				images[dragSourceIndex] = null
				idbKeyval.set(`image-${dragSourceIndex}`, null);

				dragSourceIndex = null
			}

			/**
			 * It's a file or from a different website
			 */
			else {
				items.forEach(async (item, itemI) => {
					if (item.type == "text/html") {
						item.getAsString(async string => {
							// console.log(string) // log the raw thing
							const url = extractImgUrlFromHtmlString(string)

							if (url.includes('data:image/')) {
								// It's already a data url
								this.setPadImageDataUrlAndUpdate(i + itemI, url)
							} else {
								// It's a normal, remote url
								const response = await fetch(`https://cors-anywhere.herokuapp.com/${url}`)
								const blob = await response.blob()
								const dataUrl = await readFileAsDataUrl(blob)
								console.log(dataUrl)
								this.setPadImageDataUrlAndUpdate(i + itemI, dataUrl)
							}
						})
					}

					else if (item.kind == "file") {
						const file = item.getAsFile()
						console.log(item.type)

						if (item.type == "image/gif") {
							const abuf = await file.arrayBuffer()
							const buf = buffer.Buffer.from(abuf)
							console.log(buf)

							gifFrames({ url: buf, frames: 'all' }).then(frameData => {
								for (const frame of frameData) {
									console.log(frame)
								}
								// frameData[0].getImage().pipe(fs.createWriteStream('firstframe.jpg'));
							});
						}

						else if (["image/jpeg", "image/png"].includes(item.type)) {
							const dataUrl = await readFileAsDataUrl(file)
							this.setPadImageDataUrlAndUpdate(i + itemI, dataUrl)
						}

						else {
							console.warn("file type not supported: ", item.type)
						}



					}
				});
			}



			// else if (ev.dataTransfer.items.length > 0) {
			// 	Array.from(ev.dataTransfer.items).forEach((item, fileI) => {
			// 		itemn.getAsString(url => {
			// 			const reader = new FileReader();
			// 			reader.onloadend = async () => {
			// 				// console.log('RESULT', reader.result)
			// 				this.pads[i + fileI].image = reader.result
			// 				images[i + fileI] = loadImage(reader.result)
			// 				idbKeyval.set(`image-${i + fileI}`, reader.result);
			// 				this.$forceUpdate()
			// 			}

			// 			reader.readAsDataURL(item);
			// 		});


			// 	})
			// }




			this.pads.forEach(pad => {
				pad.justTriggered = false
			});

			this.$forceUpdate()
		},

		setPadImageDataUrlAndUpdate(i, dataUrl) {
			this.pads[i].image = dataUrl
			images[i] = loadImage(dataUrl)
			idbKeyval.set(`image-${i}`, dataUrl);
			// console.log(dataUrl)
			this.$forceUpdate()
		},


		padPressed(i) {
			if (!dragSourceIndex) {
				this.triggerPad(i)
				this.pads[i].justTriggered = true
			}
		},

		padReleased(i) {
			this.pads[i].justTriggered = false
		},

		triggerPad(i) {
			if (images[i]) {
				if (mouseIsPressed) {
					imageMode(CENTER)
					image(images[i], mouseX, mouseY, this.size, images[i].height * this.size / images[i].width)
				} else {
					imageMode(CORNER)

					image(images[i], 0, 0, WIDTH, HEIGHT)
				}

			}
		},

		getNoteNameAndOctave(midiNoteNum) {
			let octave = Math.floor((midiNoteNum / 12)) - 2;
			let note = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"][midiNoteNum % 12]
			return `${octave} - ${note}`
		},

		willBeDroppedIn(i) {
			if (this.padsDropRange == null) return false
			return i > this.padsDropRange[0] && i < this.padsDropRange[1]
		}
	}
})





// MIDI ========================================
// =============================================
WebMidi.enable(err => {
	if (err) console.log(err);
	$ui.inputs = WebMidi.inputs

	let restoredMidiInput = localStorage.getItem('midiInput')
	if (restoredMidiInput) {
		$ui.currentMidiInput = WebMidi.getInputByName(restoredMidiInput);
	} else {
		$ui.currentMidiInput = WebMidi.inputs[0];
	}

	$ui.currentMidiInput.addListener("noteon", "all", e => {
		let noteNumber = e.note.number
		$ui.triggerPad(noteNumber)
		$ui.pads[noteNumber].justTriggered = true
	})

	$ui.currentMidiInput.addListener("noteoff", "all", e => {
		let noteNumber = e.note.number
		$ui.pads[noteNumber].justTriggered = false
	})

	$ui.currentMidiInput.addListener("pitchbend", "all", e => {
		console.log(e.value)
		$ui.size = map(e.value, -1, 1, 5, WIDTH * 8)
	})
});


// UTILITIES =======================================
// =================================================
function clamp(num, min, max) {
	return num <= min ? min : num >= max ? max : num;
}



async function readFileAsDataUrl(something) {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onloadend = async () => {
			resolve(reader.result)
		}
		reader.readAsDataURL(something);
	})
}

function extractImgUrlFromHtmlString(string) {
	const dummyEl = document.createElement('div')
	dummyEl.innerHTML = string
	const img = dummyEl.querySelector('img')
	// console.log(img)
	const url = img.getAttribute('src')
	return url
}