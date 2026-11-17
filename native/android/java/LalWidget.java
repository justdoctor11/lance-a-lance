package app.lancealance.coach;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;

import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.Locale;

/** Widget da tela inicial: sequência de dias, meta de hoje e revisões do repertório. */
public class LalWidget extends AppWidgetProvider {
    static final String PREFS = "lal_widget";

    @Override
    public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) {
        for (int id : ids) mgr.updateAppWidget(id, views(ctx));
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
        v.setTextViewText(R.id.w_today, n + " de " + g);
        v.setProgressBar(R.id.w_bar, Math.max(1, g), Math.min(n, g), false);
        v.setTextViewText(R.id.w_rep, rep);
        v.setTextViewText(R.id.w_last, last);
        Intent open = new Intent(ctx, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pi = PendingIntent.getActivity(ctx, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        v.setOnClickPendingIntent(R.id.w_root, pi);
        return v;
    }

    static void refreshAll(Context ctx) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
        int[] ids = mgr.getAppWidgetIds(new ComponentName(ctx, LalWidget.class));
        for (int id : ids) mgr.updateAppWidget(id, views(ctx));
    }
}
