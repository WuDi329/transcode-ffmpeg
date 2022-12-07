import { WebMWriter } from "./webm-writer.js";

export class Transcoder{
    //定义解复用worker
    demuxDecodeWorker;
    //定义复用worker
    webm_worker;
    //定义webm-writer
    writer;
    //定义返回的解码后文件的buffer
    finalBuffer;
    //定义输入文件的buffer
    buffer;
  
    //以下是对buffer改成流的做出的相应更改，这里先注释
    //  wait_for_reslut: ((value: ReadableStream<Uint8Array>) => void) | null | undefined;
    // status: Promise<ReadableStream<Uint8Array>>;
    // finalStream: ReadableStream<Uint8Array>|undefined;
    
    wait_for_reslut;
    //定义promise
    status;
  
    constructor(buffer){
      console.log('in transcoder-controller...')
      //在init中创建worker
      this.demuxDecodeWorker = new Worker("./demux_decode_worker.js");
  
      this.webm_worker = new Worker("./webm-worker.js");
  
      //为worker分别设定onmessage和onerror方法。
      this.demuxDecodeWorker.onmessage = this.demuxWorkerCallback.bind(this);
  
      this.demuxDecodeWorker.onerror = this.onerror;
  
      this.webm_worker.onerror = this.onerror;
  
      this.webm_worker.onmessage = this.webmWorkerCallback.bind(this);
  
      //创建webMWriter对象。
      this.writer = new WebMWriter();
      // console.log(this.writer)
      // console.log('demo initialize: writer finished')
      
      //创建promise，当promise fulfilled时，将会返回解码文件的buffer
      this.status = new Promise((resolve) => this.wait_for_reslut = resolve)
  
      //将输入的文件buffer赋值给buffer
      this.buffer = buffer;
      
    }
  
    onerror(e) {
      console.error(e);
    }
  
    //转码的调用
    //以下是对buffer改成流的做出的相应更改，这里先注释
    //Promise<ReadableStream<Uint8Array>> {
    async start() {
      //发送给demuxworker初始化message，并且在后续几个worker的相互作用之下进行转码的过程
      this.demuxDecodeWorker.postMessage({type: 'initialize', buffer: this.buffer});
      //当statusfulfilled，将会返回最终解码的结构
      return this.status;
    }
  
    async webmWorkerCallback(e){
      const msg = e.data;
      switch (msg.type) {
          //原本的exit由外部事件触发，在这里是根据demux_decode_worker的事件触发
          case 'exit':
              //这将作为最后一步执行
              console.log('demo: exit')
              if (msg.code !== 0) {
                  this.onerror(`muxer exited with status ${msg.code}`);
              }
              //terminate并不会等待 worker 去完成它剩余的操作；worker 将会被立刻停止
              this.webm_worker.terminate();
              console.log('demo: webm_worker terminated')
          
              //调用writer的finish函数，返回相应的结果
              const r = await this.writer.finish();
                  // console.log(r);
              console.log(`Finished: Duration ${this.writer.duration}ms, Size ${this.writer.size} bytes`);
  
                  //将r转换为blob，进而再次转换成为arraybuffer，并且resolve返回最终结果。
              const blob = new Blob(r, { type: 'video/webm' });
              console.log('blob finished')
              // 以下是对buffer改成流的做出的相应更改，这里先注释
              // this.finalStream = blob.stream();
              //       this.wait_for_reslut!(this.finalStream);
              this.finalBuffer = await blob.arrayBuffer();
              //当这一步被调用，finalbuffer返回给status。
              this.wait_for_reslut(this.finalBuffer);
              this.wait_for_reslut = null;
              break;
  
          case 'start-stream':
              //第八步：主线程接受到webm_worker的start stream信号
              console.log('demo: start stream')
              //可能可以优化的地方：
              //webm_muxer的decodeconfig和encodeconfig等是在主线程获得的，
              //而目前的写法中，decodeconfig和encodeconfig都是在transcoder中获得的
              //哪个更好还不确定？
              this.demuxDecodeWorker.postMessage({type: 'start-transcode'})
              break;
  
          case 'muxed-data':
              //理论上来说，获得muxed-data时，就代表一个encodedchunkdata经过了decode-encode再mux的过程了
              console.log('demo: muxed-data')
              await this.writer.write(msg.data);
              console.log(`Recorded ${this.writer.size} bytes`);
              break;
  
          case 'stats':
              // console.log('demo: stats')
              console.log(msg.data);
              break;
  
          case 'error':
              console.log('demo: error')
              this.onerror(msg.detail);
              break;
      }
  };
    
  
    async demuxWorkerCallback(e){
      const msg = e.data;
      switch (msg.type){
      case 'initialize-done':
        console.log('demo: initialize-done')
        // console.log('demo initialize-done : this.writer')
        // console.log(this.writer)
        //这里使用无名式的初始化方法
        await this.writer.start();
        // console.log('writer open over')
        //audiotext应当在播放的时候起到校准时间的作用，这里目前用处不大，先注释
        // myAudioContext.initialize();
      // audioController.initialize(e.data.sampleRate, e.data.channelCount,
      //                     e.data.sharedArrayBuffer);
        this.webm_worker.postMessage({
          type: 'start',
          webm_stats_interval: msg.webm_stats_interval,
          webm_metadata: msg.webm_metadata
        })
        //转码时间得切换一下
        // demuxDecodeWorker.postMessage({type: 'start-transcode'});
        break;
      case 'error':
        this.onerror(msg.err);
        break;
      case 'exit':
        console.log('index: get message exit from demux decoder');
        this.webm_worker.postMessage({type: 'end'});
        break;
      case 'terminate':
        console.log('index: terminate触发')
        this.demuxDecodeWorker.terminate();
        break;
      case 'video-data':
        this.webm_worker.postMessage(msg, [msg.data]);
        break;
      case 'audio-data':
        this.webm_worker.postMessage(msg, [msg.data]);
        break;
    }
    }
  }