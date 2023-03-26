const { Scenes } = require('telegraf')
const axios = require('axios')
const fs = require('fs')
const { spawn } = require('child_process')


class VoiceGPT {
    setData() {
        this.Data = {}
    }
    STTScene() {
        const stt = new Scenes.BaseScene('stt')
        stt.enter(async ctx => {
          this.setData()
          await ctx.reply('Отправте голосовое сообщение с запросом к нейросети GPT: ')
        })
        stt.command('cancel', async ctx => {
            await ctx.reply('Действие отменено', {
              reply_markup: {
                remove_keyboard: true
              }
            })
            delete this.Data
            return await ctx.scene.leave()
        })
        stt.on('voice', async ctx => {
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
                                        this.Data['prompt'] = res.data.msg
                                        console.log(`this.Data['prompt'] = ${this.Data['prompt']}`)
                                        ctx.scene.enter('complite')
                                        res = null
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
        return stt
    }
    CompliteScene() {
        const cmp = new Scenes.BaseScene('complite')
        cmp.enter(async ctx => {
          try {
            await ctx.reply(`Текст запроса: ${this.Data['prompt']}`)
            var resp1 = await axios.post('http://89.22.228.159:3000/api/prompt', {      
              payload: this.Data['prompt'],
            }, {
              headers: { Accept: 'application/json, */\*' },
            })
            var resp2 = await axios.post('https://localhost:8000/api/synthesize', {
                data: resp1.data.msg,
            }, {
              headers: { Accept: 'application/json, */\*' },
            })
            const name = 'public/' + randomSting(6) + '.wav'
            const buffer = Buffer.from(resp2.data.base64, 'base64')
            fs.writeFileSync(name, buffer)
            await ctx.replyWithAudio({ source: name }).then(() => {
                fs.unlinkSync(name)
            })
            return await ctx.scene.leave()
          } catch (err) {
            console.log(err)
            await ctx.reply('error!')
            return await ctx.scene.leave()
          }
        })
        return cmp
    }
}

const randomSting = length => {
  let result = ''
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const charactersLength = characters.length
  let counter = 0
  while (counter < length) {
    result += characters.charAt(Math.floor(Math.random()*charactersLength))
    counter += 1
  }
  return result
} 

module.exports = { VoiceGPT }