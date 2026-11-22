package app.lancealance.coach;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Bundle;
import android.view.View;
import android.widget.RemoteViews;

import java.io.File;

import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.Locale;

/** Widget da tela inicial: um cartão de xadrez por dia (desenhado pelo app), sequência de dias,
 *  meta de hoje e revisões do repertório. */
public class LalWidget extends AppWidgetProvider {
    static final String PREFS = "lal_widget";

    @Override
    public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) {
        for (int id : ids) mgr.updateAppWidget(id, views(ctx));
    }

    @Override
    public void onAppWidgetOptionsChanged(Context ctx, AppWidgetManager mgr, int id, Bundle opts) {
        mgr.updateAppWidget(id, views(ctx));
    }

    static Bitmap load(Context ctx, String name, boolean opaque) {
        File f = new File(ctx.getFilesDir(), name);
        if (!f.exists()) return null;
        BitmapFactory.Options o = new BitmapFactory.Options();
        if (opaque) o.inPreferredConfig = Bitmap.Config.RGB_565;
        try { return BitmapFactory.decodeFile(f.getAbsolutePath(), o); } catch (Throwable t) { return null; }
    }

    /** Cartão do dia: troca sozinho à meia-noite, sem precisar abrir o app. */
    static void art(Context ctx, SharedPreferences sp, RemoteViews v, String fallback) {
        int n = sp.getInt("artN", 0);
        Bitmap bg = null;
        int i = 0;
        if (n > 0) {
            Calendar c = Calendar.getInstance();
            i = (c.get(Calendar.YEAR) * 366 + c.get(Calendar.DAY_OF_YEAR)) % n;
            bg = load(ctx, "widget_bg_" + i + ".jpg", true);
        }
        if (bg == null) {
            v.setViewVisibility(R.id.w_art, View.GONE);
            v.setViewVisibility(R.id.w_fig, View.GONE);
            v.setViewVisibility(R.id.w_title_q, View.GONE);
            v.setViewVisibility(R.id.w_title_b, View.VISIBLE);
            v.setTextViewText(R.id.w_kick, "PEÃO PASSADO");
            v.setTextViewText(R.id.w_title_b, fallback);
            v.setTextViewText(R.id.w_sub, "");
            return;
        }
        v.setViewVisibility(R.id.w_art, View.VISIBLE);
        v.setImageViewBitmap(R.id.w_art, bg);
        Bitmap fig = sp.getBoolean("artFig_" + i, false) ? load(ctx, "widget_fig_" + i + ".png", false) : null;
        if (fig != null) { v.setImageViewBitmap(R.id.w_fig, fig); v.setViewVisibility(R.id.w_fig, View.VISIBLE); }
        else v.setViewVisibility(R.id.w_fig, View.GONE);
        boolean quote = sp.getBoolean("artQ_" + i, false);
        int on = quote ? R.id.w_title_q : R.id.w_title_b, off = quote ? R.id.w_title_b : R.id.w_title_q;
        v.setViewVisibility(on, View.VISIBLE);
        v.setViewVisibility(off, View.GONE);
        v.setTextViewText(on, sp.getString("artTitle_" + i, ""));
        v.setTextViewText(R.id.w_kick, sp.getString("artKick_" + i, ""));
        v.setTextViewText(R.id.w_sub, sp.getString("artSub_" + i, ""));
    }

    static String day(int offset) {
        Calendar c = Calendar.getInstance();
        c.add(Calendar.DAY_OF_YEAR, offset);
        return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(c.getTime());
    }

    static RemoteViews views(Context ctx) {
        SharedPreferences sp = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.lal_widget);
        String saved = sp.getString("day", "");
        String today = day(0);
        String streak = sp.getString("streak", "0");
        String streakLabel = sp.getString("streakLabel", "dias seguidos");
        String goal = sp.getString("goal", "10");
        String done = sp.getString("done", "0");
        String rep = sp.getString("rep", "—");
        String last = sp.getString("last", "Abra o app para começar");
        if (saved.isEmpty()) {
            streak = "–";
            done = "0";
            last = "Abra o app uma vez para ligar o widget";
        } else if (!saved.equals(today)) {
            // virou o dia desde a última abertura: a meta de hoje recomeça
            done = "0";
            if (!saved.equals(day(-1))) streak = "0";
            last = "Treine hoje para manter a sequência";
        }
        int n = 0, g = 10;
        try { n = Integer.parseInt(done); g = Integer.parseInt(goal); } catch (NumberFormatException e) { /* mantém o padrão */ }
        v.setTextViewText(R.id.w_streak, streak);
        v.setTextViewText(R.id.w_streak_label, streakLabel);
        v.setTextViewText(R.id.w_today, n + "/" + g);
        v.setProgressBar(R.id.w_bar, Math.max(1, g), Math.min(n, g), false);
        v.setTextViewText(R.id.w_rep, rep);
        v.setTextViewText(R.id.w_last, last);
        art(ctx, sp, v, last);
        Intent open = new Intent(ctx, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pi = PendingIntent.getActivity(ctx, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        v.setOnClickPendingIntent(android.R.id.background, pi);
        return v;
    }

    static void refreshAll(Context ctx) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
        int[] ids = mgr.getAppWidgetIds(new ComponentName(ctx, LalWidget.class));
        for (int id : ids) mgr.updateAppWidget(id, views(ctx));
    }
}
