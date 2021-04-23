let currentMidiInput
let images = {}
let popup = {}

let dragSourceIndex = null


let WIDTH = screen.width
let HEIGHT = screen.height
let NUMPADS = 127

async function setup() {
	// canvas
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
		pads: []
	},

	async mounted() {
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
			console.log("changed output to: ", this.currentMidiInput.name);

			currentMidiInput.addListener("noteon", "all", e => {
				console.log(e)
				this.triggerPad(e.note.number)
			})
		},

		dragStartHandler(i) {
			dragSourceIndex = i
		},

		dragOverHandler(i, ev) {
			ev.preventDefault();
			console.log("File(s) in drop zone", ev);
			console.log("File(s) in drop zone", ev.dataTransfer.files.length);
			console.log([i, i + ev.dataTransfer.files.length]);

			this.padsDropRange = [i, i + ev.dataTransfer.files.length]

		},

		dropHandler(i, ev) {
			ev.preventDefault();
			console.log("Dropped", ev.dataTransfer.files);



			if (ev.dataTransfer.files.length > 0) {
				Array.from(ev.dataTransfer.files).forEach((file, fileI) => {
					const reader = new FileReader();
					reader.onloadend = async () => {
						// console.log('RESULT', reader.result)
						this.pads[i + fileI].image = reader.result
						images[i + fileI] = loadImage(reader.result)
						idbKeyval.set(`image-${i + fileI}`, reader.result);
						this.$forceUpdate()
					}

					reader.readAsDataURL(file);
				})
			}


			else if (dragSourceIndex !== null) {
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

			this.pads.forEach(pad => {
				pad.justTriggered = false
			});

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
				let x = images[i].width < WIDTH ? random(WIDTH) : 0
				let y = images[i].width < WIDTH ? random(HEIGHT) : 0
				image(images[i], x, y)
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




// DRAW ===========================================

// MIDI ========================================
// =============================================


WebMidi.enable(err => {
	if (err) console.log(err);
	$ui.inputs = WebMidi.inputs
	currentMidiInput = WebMidi.inputs[0];
	currentMidiInput.addListener("noteon", "all", e => {
		let noteNumber = e.note.number
		console.log(e)
		$ui.triggerPad(noteNumber)

		$ui.pads[noteNumber].justTriggered = true

	})

	currentMidiInput.addListener("noteoff", "all", e => {
		let noteNumber = e.note.number
		console.log(e)
		$ui.pads[noteNumber].justTriggered = false
	})
});

// UTILITIES =======================================
// =================================================
function clamp(num, min, max) {
	return num <= min ? min : num >= max ? max : num;
}


// DRAG AND DROP ===================================
// =================================================

