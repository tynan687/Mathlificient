package com.tynan.mathtutor

import android.app.Activity
import android.app.Application
import android.os.Bundle
import java.util.concurrent.atomic.AtomicInteger

/**
 * Tracks whether one of our own activities (practice, formula sheet, timer,
 * settings) is currently in the foreground, so the tutor's screen capture and
 * watch loop can skip — otherwise it would waste checks looking at our own UI.
 */
class TutorApp : Application() {

    override fun onCreate() {
        super.onCreate()
        registerActivityLifecycleCallbacks(object : ActivityLifecycleCallbacks {
            override fun onActivityResumed(activity: Activity) { foreground.incrementAndGet() }
            override fun onActivityPaused(activity: Activity) {
                foreground.updateAndGet { if (it > 0) it - 1 else 0 }
            }

            override fun onActivityCreated(a: Activity, b: Bundle?) {}
            override fun onActivityStarted(a: Activity) {}
            override fun onActivityStopped(a: Activity) {}
            override fun onActivitySaveInstanceState(a: Activity, b: Bundle) {}
            override fun onActivityDestroyed(a: Activity) {}
        })
    }

    companion object {
        private val foreground = AtomicInteger(0)

        /** True when one of the app's own screens is on top of the tutor's view. */
        fun ownUiForeground(): Boolean = foreground.get() > 0
    }
}
