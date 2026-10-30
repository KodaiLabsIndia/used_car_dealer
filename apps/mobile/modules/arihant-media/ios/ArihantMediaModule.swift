import ExpoModulesCore
import AVFoundation

public class ArihantMediaModule: Module {
  private var current: AVAssetExportSession?
  private var output: URL?
  private let stateLock = NSLock()
  private var preparing = false
  private var cancelled = false
  public func definition() -> ModuleDefinition {
    Name("ArihantMedia")
    OnCreate {
      let cutoff = Date()
      let directory = FileManager.default.urls(for:.applicationSupportDirectory,in:.userDomainMask)[0].appendingPathComponent("arihant-prepared-video",isDirectory:true)
      DispatchQueue.global(qos:.utility).async {
        let files = (try? FileManager.default.contentsOfDirectory(at:directory,includingPropertiesForKeys:[.contentModificationDateKey])) ?? []
        for file in files where file.lastPathComponent.hasSuffix(".partial.mp4") {
          if let changed = try? file.resourceValues(forKeys:[.contentModificationDateKey]).contentModificationDate, changed < cutoff {
            try? FileManager.default.removeItem(at:file)
          }
        }
      }
    }
    AsyncFunction("inspect") { (uri: String) async throws -> [String: Any] in
      try await self.inspect(uri)
    }
    AsyncFunction("normalize") { (uri: String) async throws -> [String: Any] in
      guard self.reserve() else { throw NSError(domain: "ENCODER_BUSY", code: 1, userInfo: [NSLocalizedDescriptionKey:"Another clip is being prepared."]) }
      defer { self.release() }
      guard let source = URL(string:uri), source.isFileURL else { throw self.failure("Choose a local clip.") }
      let info = try await self.inspect(uri)
      let width = info["width"] as! Int, height = info["height"] as! Int
      let duration = info["durationMs"] as! Int
      guard duration > 0 && duration <= 30000 else { throw self.failure("Record a clip of 30 seconds or less.") }
      // HDR is rejected until tone mapping is verified on supported iPhones.
      guard info["hdr"] as? Bool == false else { throw self.failure("Record a new clip with HDR off. This clip stays on your phone.") }
      let target = height > width ? CGSize(width:720,height:1280) : CGSize(width:1280,height:720)
      let scale = min(target.width/CGFloat(width),target.height/CGFloat(height))
      guard scale <= 1.01 else { throw self.failure("This clip is too small. Record a new 720p clip.") }
      let asset = AVURLAsset(url:source)
      guard let track = try await asset.loadTracks(withMediaType:.video).first else { throw self.failure("No video track.") }
      let size = try await track.load(.naturalSize), preferred = try await track.load(.preferredTransform)
      let rect = CGRect(origin:.zero,size:size).applying(preferred)
      let transform = preferred.concatenating(CGAffineTransform(translationX:-rect.minX,y:-rect.minY))
        .concatenating(CGAffineTransform(scaleX:scale,y:scale))
        .concatenating(CGAffineTransform(translationX:(target.width-rect.width*scale)/2,y:(target.height-rect.height*scale)/2))
      let composition = AVMutableVideoComposition()
      composition.renderSize = target
      composition.frameDuration = CMTime(value:1,timescale:30)
      let layer = AVMutableVideoCompositionLayerInstruction(assetTrack:track)
      layer.setTransform(transform,at:.zero)
      let instruction = AVMutableVideoCompositionInstruction()
      instruction.timeRange = CMTimeRange(start:.zero,duration:try await asset.load(.duration))
      instruction.layerInstructions = [layer]
      instruction.backgroundColor = CGColor(gray:0,alpha:1)
      composition.instructions = [instruction]
      composition.colorPrimaries = AVVideoColorPrimaries_ITU_R_709_2
      composition.colorTransferFunction = AVVideoTransferFunction_ITU_R_709_2
      composition.colorYCbCrMatrix = AVVideoYCbCrMatrix_ITU_R_709_2
      guard let export = AVAssetExportSession(asset:asset,presetName:AVAssetExportPresetHighestQuality) else { throw self.failure("Encoder unavailable.") }
      let directory = FileManager.default.urls(for:.applicationSupportDirectory,in:.userDomainMask)[0].appendingPathComponent("arihant-prepared-video",isDirectory:true)
      try FileManager.default.createDirectory(at:directory,withIntermediateDirectories:true)
      let path = directory.appendingPathComponent(UUID().uuidString+".partial.mp4")
      export.videoComposition=composition; export.outputURL=path;export.outputFileType = .mp4;export.shouldOptimizeForNetworkUse=true
      do {
        try self.install(export, output:path)
        await withCheckedContinuation { (continuation:CheckedContinuation<Void,Never>) in export.exportAsynchronously {continuation.resume()} }
        guard export.status == .completed else { throw self.failure("Could not prepare this clip. Retake or retry.") }
        var result = try await self.inspect(path.absoluteString)
        let bytes = (try FileManager.default.attributesOfItem(atPath:path.path)[.size] as? NSNumber)?.intValue ?? 0
        guard result["width"] as? Int == Int(target.width),result["height"] as? Int == Int(target.height),result["videoMime"] as? String == "video/avc",result["hdr"] as? Bool == false,(result["fps"] as? Double ?? 0) > 0,(result["fps"] as? Double ?? 100) <= 30.5,bytes > 0,bytes <= 33554432 else {throw self.failure("The prepared output did not meet the 720p profile.")}
        let final = directory.appendingPathComponent(path.lastPathComponent.replacingOccurrences(of:".partial",with:""))
        try FileManager.default.moveItem(at:path,to:final)
        result["uri"]=final.absoluteString;result["bytes"]=bytes;result["profile"]="video-720-v1"
        return result
      } catch {try? FileManager.default.removeItem(at:path);throw error}
    }
    AsyncFunction("cancel") { self.cancel() }
    OnDestroy { self.cancel() }
  }
  private func reserve() -> Bool {
    stateLock.lock(); defer { stateLock.unlock() }
    guard !preparing else { return false }
    preparing=true; cancelled=false; return true
  }
  private func release() {
    stateLock.lock(); defer { stateLock.unlock() }
    current=nil; output=nil; preparing=false
  }
  private func install(_ export:AVAssetExportSession, output:URL) throws {
    stateLock.lock(); defer { stateLock.unlock() }
    guard !cancelled else { throw failure("Preparation cancelled. Retry when ready.") }
    current=export; self.output=output
  }
  private func cancel() {
    stateLock.lock(); cancelled=true; let export=current; stateLock.unlock()
    export?.cancelExport()
  }
  private func failure(_ message:String)->NSError { NSError(domain:"ARIHANT_MEDIA",code:1,userInfo:[NSLocalizedDescriptionKey:message]) }
  private func inspect(_ uri:String) async throws -> [String:Any] {
    guard let url=URL(string:uri),url.isFileURL else {throw failure("Choose a local clip.")}
    let asset=AVURLAsset(url:url)
    guard let track=try await asset.loadTracks(withMediaType:.video).first else {throw failure("No video track.")}
    let size=try await track.load(.naturalSize),transform=try await track.load(.preferredTransform)
    let rect=CGRect(origin:.zero,size:size).applying(transform)
    let formats=try await track.load(.formatDescriptions)
    let subtype=formats.first.map { CMFormatDescriptionGetMediaSubType($0) } ?? 0
    let fps=Double(try await track.load(.nominalFrameRate))
    let hdr=track.hasMediaCharacteristic(.containsHDRVideo)
    return ["width":Int(abs(rect.width).rounded()),"height":Int(abs(rect.height).rounded()),"durationMs":Int((try await asset.load(.duration)).seconds*1000),"videoMime":subtype == kCMVideoCodecType_H264 ? "video/avc":"other","fps":fps,"hdr":hdr]
  }
}
