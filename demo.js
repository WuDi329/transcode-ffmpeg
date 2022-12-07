const VIDEO_STREAM_TYPE = 1;
const AUDIO_STREAM_TYPE = 0;

import {max_video_config} from './resolution.js'
export class WebmMuxer{
    constructor(){

    }

    
    vp9_encoder_constraints = {
      // codec: 'av01.0.08M.08',
      codec: 'vp09.00.10.08.01',
      width: 720,
      height: 1280,
      bitrate: 1725000,
      framerate: 30,
      latencyMode: 'realtime'
  }

    encoder_constraints = {
        // codec: 'av01.0.08M.08',
        codec: 'vp09.00.10.08.01',
        width: 640,
        height: 360,
        bitrate: 356000,
        framerate: 30,
        latencyMode: 'realtime'
    }
    async initialize(demuxer) {
        if(demuxer.streamType === AUDIO_STREAM_TYPE) {

        } else {
            // this.codec = 'av01.0.00M.08',//这里先写死
            this.codec = 'vp09.00.10.08.01'
            // this.displayWidth = demuxer.getDecoderConfig().displayWidth;
            // this.displayHeight = demuxer.getDecoderConfig().displayHeight;
            this.width= 640,
            this.height= 360,
            this.bitrate = 2500 * 100;
            this.framerate = 30;
            this.latencyMode = 'realtime';
        }
        
    
        //不管是videotrack还是audiotrack都ready了
        await this._tracksReady();
    
        if (this.streamType == AUDIO_STREAM_TYPE) {
          this._selectTrack(this.audioTrack);
        } else {
          this._selectTrack(this.videoTrack);
        }
        console.log('muxer initialize finished')
      }

      async getEncoderConfig(decodeconfig, bitrate, framerate) {

        this.vp9_encoder_constraints.width = decodeconfig.codedWidth;
        this.vp9_encoder_constraints.height = decodeconfig.codedHeight;
  
  
        this.vp9_encoder_constraints.bitrate = bitrate;
        this.vp9_encoder_constraints.framerate = framerate;
  
            console.log('in getencoder config');
            console.log(this.vp9_encoder_constraints)
              return await max_video_config({
                  ...this.vp9_encoder_constraints,
                  ratio: this.vp9_encoder_constraints.width / this.vp9_encoder_constraints.height
              }) || await max_video_config(this.vp9_encoder_constraints);
        }
  
}