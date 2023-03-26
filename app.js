const { Telegraf, Scenes, session } = require('telegraf')
const TOKEN = '6230036462:AAFdr9Wbex8-JbzGIdTeTkqySEnnhv1Ob2U'
const bot = new Telegraf(TOKEN)
const axios = require('axios')
const fs = require('fs')
const { spawn } = require('child_process')

Scenes
const { VoiceGPT } = require('./gpt-scene')
const gpt = new VoiceGPT()
const stt = gpt.STTScene()
const cmp = gpt.CompliteScene()
const stage = new Scenes.Stage([stt, cmp])

bot.use(session())
bot.use(stage.middleware())

bot.start(async ctx => {
  try {
    return await ctx.replyWithHTML(`Привет ${ctx.from.first_name}!`)
  } catch (error) {
    console.error(error)
  }
})

bot.on('voice', async(ctx) => {
  try{
    const voice_id = ctx.message.message_id
    var filename = 'public/' + randomSting(6)
    ctx.telegram
      .getFileLink(ctx.message.voice.file_id)
        .then((url) => {
          axios.get(url, { responseType: "arraybuffer" })
              .then((voice) => {
                fs.promises.writeFile(`${filename}.ogg`, voice.data)
                  .then(() => {
                    const ffmpeg_run = spawn('ffmpeg',
                    ['-loglevel', 'panic', '-i', `${filename}.ogg`,
                    '-f', 'wav', '-bitexact', '-acodec', 'pcm_s16le',
                    '-ar', '16000', '-ac', '1', `${filename}.wav`])
                    ffmpeg_run.on('close', () => {
                      fs.unlinkSync(`${filename}.ogg`)
                      fs.promises.readFile(`${filename}.wav`)
                        .then((buff) => {
                          var buffer = Buffer.from(buff).toString('base64')
                          axios.put('https://localhost:8000/api/recognize', {
			                      headers: { Accept: 'application/json, */\*' },
			                      proxy: false,
                            data: buffer,
                            cache: false,
                            maxRedirects: 0
                          }).then((res) => {
                            ctx.reply(res.data.msg)
                            res = null
                            //ctx.deleteMessage(voice_id)
                          }).catch((e) => {
                            console.log('axios error: ' + e)
                          })
                          fs.unlinkSync(`${filename}.wav`)
                          buffer = null
                        }).catch((e) => {
                          console.log('read file error: ' + e)
                        })
                    })
                  }).catch((e) => {
                    console.log('write file error: ' + e)
                  })
              })

          }).catch(e => {
            console.log('getFileLink error: ' + e)
          })
  } catch (e) {
    console.log(e)
    fs.unlinkSync('public/*.ogg')
    fs.unlinkSync('public/*.wav')
  }
})

// bot.on('voice', async (ctx) => {
//   try {
//     const voice_id = ctx.message.message_id
//     var filename = 'public/' + randomSting(6)
//     const url = await ctx.telegram.getFileLink(ctx.message.voice.file_id)
//     const voice = await axios.get(url, { responseType: "arraybuffer" })
//     fs.promises.writeFile(`${filename}.ogg`, voice.data)
//       .then(() => {
//         const ffmpeg_run = spawn('ffmpeg',
//           ['-loglevel', 'panic', '-i', `${filename}.ogg`,
//             '-f', 'wav', '-bitexact', '-acodec', 'pcm_s16le',
//             '-ar', '16000', '-ac', '1', `${filename}.wav`])
//         ffmpeg_run.on('close', () => {
//           fs.unlinkSync(`${filename}.ogg`)

//         })
//       })
//     fs.promises.readFile(`${filename}.wav`)
//       .then((buff) => {
//         var buffer = Buffer.from(buff).toString('base64')
//         axios.put('https://localhost:8000/api/recognize', {
//           headers: { Accept: 'application/json, */\*' },
//           proxy: false,
//           data: buffer,
//           cache: false,
//           maxRedirects: 0
//         }).then((res) => {
//           ctx.reply(res.data.msg)
//           res = null
//           //ctx.deleteMessage(voice_id)
//         }).catch((e) => {
//           console.log('axios error: ' + e)
//         })
//         fs.unlinkSync(`${filename}.wav`)
//         buffer = null
//         }).catch((e) => {
//           console.log('read file error: ' + e)
//         })
//   } catch (e) {
//     console.log(e)
//     fs.unlinkSync('public/*.ogg')
//     fs.unlinkSync('public/*.wav')
//   }
// })

bot.command('say', async ctx => {
  const name = 'public/' + randomSting(6) + '.wav'
  try {
    const text = ctx.message.text.split('/say')[1]
    const { data } = await axios.post('https://localhost:8000/api/synthesize', {
      headers: { Accept: 'application/json, */\*' },
      proxy: false,
      data: text,
      cache: false,
      maxRedirects: 0
    })
    const buffer = Buffer.from(data.base64, 'base64') //data:audio/wav;base64,
    fs.writeFileSync(name, buffer)
    ctx.replyWithAudio({ source: name }).then(() => {
      fs.unlinkSync(name)
    })
  } catch (e) {
    console.log(e)
  }
})

bot.command('gpt', async ctx => {
  try {
    return await ctx.scene.enter('stt')
  } catch (err) {
    console.log(err)
  }
})

bot.on('text', async ctx => {
  try {
    const text = ctx.message.text
    console.log(text)
    var { data } = await axios.post('http://89.22.228.159:3000/api/prompt', {
      payload: text
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    })
    await ctx.reply(data.msg)
  } catch (e) {
    console.log(e)
  }
})


//Error Handler
bot.catch((err, ctx) => {
  console.log(`Ooops, encountered an error for ${ctx.updateType}`, err)
})
//

bot.launch()
console.log('bot has been started!')



const randomSting = length => {
  let result = ''
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const charactersLength = characters.length
  let counter = 0
  while (counter < length) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength))
    counter += 1
  }
  return result
} 
