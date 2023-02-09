const FormData = require('form-data')
const axios = require('axios')

const { Configuration, OpenAIApi } = require('openai')
const { writeFile } = require('fs').promises
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY
})
const AWS = require('aws-sdk')
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_ACCESS_SECRET
})

const openai = new OpenAIApi(configuration)

const getGeneratedImage = async (
  prompt = 'portrait of a badger in renaissance oil painting'
) => {
  try {
    const response = await openai.createImage({
      prompt,
      n: 1,
      size: '256x256'
    })

    const img = response.data.data[0].url
    console.log({ img })
    const res = await axios.get(img, {
      responseType: 'arraybuffer'
    })

    const buffer = Buffer.from(res.data, 'base64')

    const params = {
      Bucket: 'lithium-launchpad-cms',
      Key: `user-profile-pic${Date.now()}.png`,
      Body: buffer,
      ACL: 'public-read'
    }
    const { Location } = await s3.upload(params).promise()
    return Location
  } catch (error) {
    console.error(error)
  }
}

module.exports = { getGeneratedImage }
