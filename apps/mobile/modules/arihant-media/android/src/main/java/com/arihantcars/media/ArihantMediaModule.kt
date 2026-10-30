package com.arihantcars.media

import android.media.MediaExtractor
import android.media.MediaFormat
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.os.Handler
import android.os.Looper
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.util.UnstableApi
import androidx.media3.effect.FrameDropEffect
import androidx.media3.effect.Presentation
import androidx.media3.transformer.*
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.util.UUID
import java.util.concurrent.Executors
import kotlin.math.min

@UnstableApi
class ArihantMediaModule : Module() {
  // Transformer is confined to the main looper; metadata reads run on a bounded worker.
  private var current: Transformer? = null
  private var output: File? = null
  private var pending: Promise? = null
  private var operationId: UUID? = null
  private val handler = Handler(Looper.getMainLooper())
  private val metadataWorker = Executors.newSingleThreadExecutor()

  override fun definition() = ModuleDefinition {
    Name("ArihantMedia")
    OnCreate {
      metadataWorker.execute {
        val context = appContext.reactContext
        // Partial exports cannot be upload-ready. This queue runs before any
        // new source inspection; completed files and saved sources are retained.
        val directory = context?.let { File(it.filesDir, "arihant-prepared-video") }
        directory?.listFiles()?.filter { it.isFile && it.name.endsWith(".partial.mp4") }?.forEach { it.delete() }
      }
    }
    AsyncFunction("inspect") { uri: String -> inspect(Uri.parse(uri)) }
    AsyncFunction("normalize") { source: String, promise: Promise ->
      handler.post {
        if (operationId != null) {
          promise.reject("ENCODER_BUSY", "Another clip is being prepared.", null)
          return@post
        }
        val id = UUID.randomUUID()
        operationId = id
        pending = promise
        metadataWorker.execute {
          try {
            val input = inspect(Uri.parse(source))
            val width = input["width"] as Int
            val height = input["height"] as Int
            val duration = input["durationMs"] as Long
            require(duration in 1..30000) { "Record a clip of 30 seconds or less." }
            val portrait = height > width
            val targetWidth = if (portrait) 720 else 1280
            val targetHeight = if (portrait) 1280 else 720
            require(min(targetWidth.toDouble()/width, targetHeight.toDouble()/height) <= 1.01) {
              "This clip is too small. Record a new 720p clip."
            }
            handler.post {
              if (operationId == id) startExport(id, source, targetWidth, targetHeight)
            }
          } catch (error: Exception) {
            handler.post { fail(id, "ENCODE_FAILED", error.message ?: "Unreadable clip.", error) }
          }
        }
      }
    }
    AsyncFunction("cancel") {
      handler.post { cancel("ENCODE_CANCELLED", "Preparation cancelled. The original was not uploaded.") }
    }
    OnDestroy {
      handler.post {
        cancel("ENCODE_INTERRUPTED", "Preparation interrupted. Retry when the app opens.")
        metadataWorker.shutdown()
      }
    }
  }

  private fun startExport(id: UUID, source: String, targetWidth: Int, targetHeight: Int) {
    try {
      val context = appContext.reactContext ?: error("No app context")
      val directory = File(context.filesDir, "arihant-prepared-video").apply { mkdirs() }
      val destination = File(directory, "${UUID.randomUUID()}.partial.mp4")
      output = destination
      val effects = Effects(emptyList(), listOf(
        Presentation.createForWidthAndHeight(targetWidth, targetHeight, Presentation.LAYOUT_SCALE_TO_FIT),
        FrameDropEffect.createDefaultFrameDropEffect(30f)
      ))
      val item = EditedMediaItem.Builder(MediaItem.fromUri(source)).setEffects(effects).build()
      val composition = Composition.Builder(EditedMediaItemSequence.withAudioAndVideoFrom(listOf(item)))
        .setHdrMode(Composition.HDR_MODE_TONE_MAP_HDR_TO_SDR_USING_OPEN_GL).build()
      val encoder = DefaultEncoderFactory.Builder(context).setEnableFallback(false)
        .setRequestedVideoEncoderSettings(VideoEncoderSettings.Builder().setBitrate(4000000).build()).build()
      current = Transformer.Builder(context).setVideoMimeType(MimeTypes.VIDEO_H264).setAudioMimeType(MimeTypes.AUDIO_AAC)
        .setEncoderFactory(encoder).addListener(object: Transformer.Listener {
          override fun onCompleted(composition: Composition, result: ExportResult) {
            if (operationId != id) return
            metadataWorker.execute {
              try {
                val info = inspect(Uri.fromFile(destination))
                require(info["width"] == targetWidth && info["height"] == targetHeight) { "Output dimensions are not 720p." }
                require(info["videoMime"] == "video/avc" && info["hdr"] == false) { "Output is not SDR H.264." }
                val fps = info["fps"] as Double
                require(fps.isFinite() && fps > 0 && fps <= 30.5) { "Output frame rate is invalid." }
                require(destination.length() in 1..33554432) { "Prepared clip is too large." }
                handler.post {
                  if (operationId != id) return@post
                  try {
                    val final = File(directory, destination.name.replace(".partial", ""))
                    require(destination.renameTo(final)) { "Could not save prepared clip." }
                    val promise = pending
                    clearActive()
                    promise?.resolve(info + mapOf("uri" to Uri.fromFile(final).toString(), "bytes" to final.length(), "profile" to "video-720-v1"))
                  } catch (error: Exception) {
                    fail(id, "ENCODE_INVALID", error.message ?: "Invalid prepared clip.", error)
                  }
                }
              } catch (error: Exception) {
                handler.post { fail(id, "ENCODE_INVALID", error.message ?: "Invalid prepared clip.", error) }
              }
            }
          }
          override fun onError(composition: Composition, result: ExportResult, error: ExportException) {
            fail(id, "ENCODE_FAILED", "Could not prepare the clip. Retake or retry; the original was not uploaded.", error)
          }
        }).build()
      current!!.start(composition, destination.absolutePath)
    } catch (error: Exception) {
      fail(id, "ENCODE_FAILED", error.message ?: "Could not prepare the clip.", error)
    }
  }

  private fun clearActive() {
    current = null
    output = null
    pending = null
    operationId = null
  }

  private fun fail(id: UUID, code: String, message: String, error: Exception) {
    if (operationId != id) return
    val transformer = current
    val file = output
    val promise = pending
    clearActive()
    try { transformer?.cancel() } finally { file?.delete(); promise?.reject(code, message, error) }
  }

  private fun cancel(code: String, message: String) {
    val transformer = current
    val file = output
    val promise = pending
    clearActive()
    try { transformer?.cancel() } finally { file?.delete(); promise?.reject(code, message, null) }
  }

  private fun inspect(uri: Uri): Map<String, Any> {
    require(uri.scheme == "file" || uri.scheme == "content") { "Choose a local clip." }
    val context = appContext.reactContext ?: error("No app context")
    val reader = MediaMetadataRetriever()
    val extractor = MediaExtractor()
    try {
      reader.setDataSource(context, uri)
      val encodedWidth = reader.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH)?.toInt() ?: 0
      val encodedHeight = reader.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT)?.toInt() ?: 0
      val rotation = reader.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_ROTATION)?.toInt() ?: 0
      val duration = reader.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLong() ?: 0L
      require(encodedWidth > 0 && encodedHeight > 0 && duration > 0) { "Unreadable clip." }
      extractor.setDataSource(context, uri, null)
      var mime = ""; var fps = 0.0; var hdr = false; var audioMime = ""
      for (index in 0 until extractor.trackCount) {
        val format = extractor.getTrackFormat(index)
        val type = format.getString(MediaFormat.KEY_MIME) ?: ""
        if (type.startsWith("video/")) {
          mime = type
          if (format.containsKey(MediaFormat.KEY_FRAME_RATE)) fps = try { format.getInteger(MediaFormat.KEY_FRAME_RATE).toDouble() } catch (_: Exception) { format.getFloat(MediaFormat.KEY_FRAME_RATE).toDouble() }
          val transfer = if (format.containsKey(MediaFormat.KEY_COLOR_TRANSFER)) format.getInteger(MediaFormat.KEY_COLOR_TRANSFER) else 0
          hdr = transfer == MediaFormat.COLOR_TRANSFER_ST2084 || transfer == MediaFormat.COLOR_TRANSFER_HLG
        } else if (type.startsWith("audio/")) audioMime = type
      }
      require(mime.isNotEmpty()) { "No video track." }
      return mapOf("width" to if (rotation % 180 == 0) encodedWidth else encodedHeight,
        "height" to if (rotation % 180 == 0) encodedHeight else encodedWidth,
        "durationMs" to duration, "rotation" to rotation, "videoMime" to mime, "audioMime" to audioMime, "fps" to fps, "hdr" to hdr)
    } finally { reader.release(); extractor.release() }
  }
}
