package com.ohavs.payments.detect;

import android.app.job.JobInfo;
import android.app.job.JobParameters;
import android.app.job.JobScheduler;
import android.app.job.JobService;
import android.content.ComponentName;
import android.content.Context;

/** Runs the Gmail receipt check about once an hour, whenever there is a network. */
public class GmailReceiptJob extends JobService {
    private static final int JOB_ID = 0x676d6c31;
    private static final long PERIOD_MS = 60L * 60 * 1000;

    static void schedule(Context c) {
        JobScheduler js = c.getSystemService(JobScheduler.class);
        if (js == null || js.getPendingJob(JOB_ID) != null) return;
        js.schedule(new JobInfo.Builder(JOB_ID, new ComponentName(c, GmailReceiptJob.class))
            .setPeriodic(PERIOD_MS)
            .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
            .setPersisted(true)
            .build());
    }

    static void cancel(Context c) {
        JobScheduler js = c.getSystemService(JobScheduler.class);
        if (js != null) js.cancel(JOB_ID);
    }

    @Override
    public boolean onStartJob(JobParameters params) {
        Context app = getApplicationContext();
        new Thread(() -> {
            GmailReceiptScanner.scan(app, false);
            jobFinished(params, false);
        }, "gmail-receipts").start();
        return true;
    }

    @Override
    public boolean onStopJob(JobParameters params) {
        return true;
    }
}
