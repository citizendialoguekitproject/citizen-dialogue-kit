const jimp = require('jimp');
const fs = require('fs');
const config = require('./config');

const threshold = config.API_PIXEL_THRESHOLD;

exports.image_to_epaper = function(settings, path_input, path_output, cb) {

	var output = fs.createWriteStream(path_output);
	var n_bytes = 0;

	jimp.read(path_input, function(err, image) {

		if (err) {
			console.dir(err);
			return 0;
		}

		// emit a sequence of count pixels of color what
		var emit = function(f, what, count) {
			var color = (what & 0x03);
			if (count <= 0xf) {
				// small sequence, packs into one byte
				var d = Buffer.allocUnsafe(1);
				var v = (color << 6) | (0<<4) | count;
				d.writeUInt8(v, 0);
				f.write(d);
				n_bytes++;
			} else if (count <= 0x0fff) {
				// larger sequence, packs into two bytes
				var d = Buffer.allocUnsafe(2);
				var v_upper = (color << 6) | (1<<4) | ((count>>8)&0xf);
				var v_lower = count & 0xff;
				d.writeUInt8(v_upper, 0);
				d.writeUInt8(v_lower, 1);
				f.write(d);
				n_bytes += 2;
			}
		};

		var prev_pixel = null;
		var count = 0;

		for (var i = 0; i < (image.bitmap.width * image.bitmap.height); i++) {
			var off = i*4;

			// calculate this pixel
			var R = this.bitmap.data[off+0] >= threshold ? true : false;
			var G = this.bitmap.data[off+1] >= threshold ? true : false;
			var B = this.bitmap.data[off+2] >= threshold ? true : false;
			var pixel = undefined;
			if (settings.color_strat === 'BW') {
				// black only if nothing over threshold,
				// else white
				if (!(R || G || B)) {
					pixel = 0x1;		// black
				} else {
					pixel = 0x0;		// white
				}
			} else if (settings.color_strat === 'BWR') {
				// red if only red over threshold,
				// black if nothing over threshold,
				// else white
				if (R && !(G || B)) {
					pixel = 0x2;		// red
				} else if (!(R || G || B)) {
					pixel = 0x1;		// black
				} else {
					pixel = 0x0;		// white
				}
			} else if (settings.color_strat === 'BWY') {
				// yellow if only red and green over threshold,
				// black if nothing over threshold,
				// else white
				if (R && G && !B) {
					pixel = 0x2;		// yellow
				} else if (!(R || G || B)) {
					pixel = 0x1;		// black
				} else {
					pixel = 0x0;		// white
				}
			}
			if (prev_pixel == null) {
				// start of new sequence of equal pixels
				prev_pixel = pixel;
				count = 1;
			} else {
				// sequence of equal pixels already running
				if (prev_pixel == pixel && count < 0x0fff) {
					// and this one is the same, just extend sequence
					count++;
				} else {
					// this pixel breaks the sequence (or the sequencey got
					// too long), emit the sequence and start a new one based
					// on this pixel
					emit(output, prev_pixel, count);
					prev_pixel = pixel;
					count = 1;
				}
			}
		}
		// flush the last sequence
		emit(output, prev_pixel, count);

		output.end();

		cb(n_bytes);

	});

}

exports.screen_types = {
	'Waveshare_7.5_BW' : {
		color_strat : 'BW',
	},
	'Waveshare_7.5_BWY' : {
		color_strat : 'BWY',
	},
	'Waveshare_7.5_BWR' : {
		color_strat : 'BWR',
	},
	'Waveshare_4.2_BW' : {
		color_strat : 'BW',
	},
	'Waveshare_4.2_BWY' : {
		color_strat : 'BWY',
	},
	'Waveshare_4.2_BWR' : {
		color_strat : 'BWR',
	},
};

exports.screen_type_settings = function(desc) {

	return exports.screen_types[desc];

}
