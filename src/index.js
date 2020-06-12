/**
 * Qiniu storage module for Ghost blog 3.x
 * @see https://ghost.org/docs/concepts/storage-adapters/#using-a-custom-storage-adapter
 */

'use strict'

const url = require('url')
const path = require('path')
const BaseAdapter = require('ghost-storage-base')
const qiniu = require('qiniu')
const moment = require('moment')
const fetch = require('node-fetch')


const compile = source => {
  return context => {
    const props = Object.keys(context).join(', ')
    return new Function(`{ ${props} }`, `return \`${source}\``)(context)
  }
}

/**
 * Get path format context
 */
const getPathContext = original => {
  const date = moment()
  return {
    year: date.format('YYYY'),
    month: date.format('MM'),
    day: date.format('DD'),
    hour: date.format('HH'),
    timestamp: date.format('x'),
    random: Math.random().toString().substr(-8),
    ext: path.extname(original),
    name: path.basename(original, path.extname(original))
  }
}

class GhostQiNiuStoreAdapter extends BaseAdapter {
  constructor(config) {
    super()

    let {
      accessKey,
      secretKey,
      bucket,
      domain,
      format = '${year}/${month}/${name}${ext}'
    } = config

    this.accessKey = accessKey
    this.secretKey = secretKey
    this.bucket = bucket
    this.domain = domain

    this.dirFormat = path.dirname(format)
    this.nameFormat = path.basename(format)
  }

  exists(file, targetDir) {
    return new Promise((resolve, reject) => {
      resolve(false)
    })
  }

  save(file, targetDir) {
    const context = getPathContext(file.name)

    const upload = key => new Promise((resolve, reject) => {
      const mac = new qiniu.auth.digest.Mac(this.accessKey, this.secretKey)
      const putPolicy = new qiniu.rs.PutPolicy({
        scope: this.bucket
      })
      const uploadToken = putPolicy.uploadToken(mac)
      // 构建配置类
      const config = new qiniu.conf.Config()
      const uploader = new qiniu.form_up.FormUploader(config)

      const putExtra = new qiniu.form_up.PutExtra()

      uploader.putFile(uploadToken, key, file.path, putExtra, (responseError, responseBody, responseInfo) => {
        if (responseError) return reject(responseError)
        if (responseInfo.statusCode !== 200) return reject(new Error(responseBody.error))
        resolve(responseBody)
      })
    })

    targetDir = targetDir || compile(this.dirFormat)(context)

    file.name = compile(this.nameFormat)(context)

    return this.getUniqueFileName(file, targetDir)
      .then(filename => upload(filename.replace(/\\/g, '/'), file.path))
      .then(res => url.resolve(this.domain, res.key))
  }

  serve() {
    return (req, res, next) => next()
  }

  delete() {
    return Promise.reject(new Error('Not implemented'))
  }

  read(file) {
    const pathname = url.parse(file.path).pathname
    if (!pathname) return Promise.reject(new Error(`Could not read file: ${file.path}`))
    return fetch(url.resolve(this.domain, pathname)).then(response => response.buffer())
  }
}

module.exports = GhostQiNiuStoreAdapter;
