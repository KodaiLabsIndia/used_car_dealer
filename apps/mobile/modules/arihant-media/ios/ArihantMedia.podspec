Pod::Spec.new do |s|
  s.name = 'ArihantMedia'
  s.version = '0.1.0'
  s.summary = 'Fixed 720p evidence preparation'
  s.description = s.summary
  s.license = 'UNLICENSED'
  s.author = 'Arihant Cars'
  s.homepage = 'https://www.arihantcars.com'
  s.platforms = { :ios => '16.4' }
  s.source = { :path => '.' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.swift'
end
