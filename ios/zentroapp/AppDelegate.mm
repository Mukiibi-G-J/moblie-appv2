#import "AppDelegate.h"

#import <React/RCTBundleURLProvider.h>
#import <Firebase.h>

@implementation AppDelegate

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
  // Configure Firebase only when GoogleService-Info.plist is bundled; without it
  // [FIRApp configure] throws and the app would crash on launch. The JS side
  // (index.js, NotificationService.ts) already skips push when Firebase is absent.
  if ([FIRApp defaultApp] == nil &&
      [[NSBundle mainBundle] pathForResource:@"GoogleService-Info" ofType:@"plist"] != nil) {
    [FIRApp configure];
  }

  self.moduleName = @"zentroapp";
  // You can add your custom initial props in the dictionary below.
  // They will be passed down to the ViewController used by React Native.
  self.initialProps = @{};

  return [super application:application didFinishLaunchingWithOptions:launchOptions];
}

- (NSURL *)sourceURLForBridge:(RCTBridge *)bridge
{
  return [self bundleURL];
}

- (NSURL *)bundleURL
{
#if DEBUG
  return [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:@"index"];
#else
  return [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];
#endif
}

@end
