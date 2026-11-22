package app.lancealance.coach;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Base64;

import com.getcapacitor.JSArray;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;

/** Ponte do app (JavaScript) para o widget: guarda os números e redesenha o widget. */
@CapacitorPlugin(name = "LalWidget")
public class LalWidgetPlugin extends Plugin {
    private static final String[] KEYS = { "day", "streak", "streakLabel", "today", "goal", "done", "rep", "last", "user" };

    @PluginMethod
    public void update(PluginCall call) {
        Context ctx = getContext();
        SharedPreferences.Editor ed = ctx.getSharedPreferences(LalWidget.PREFS, Context.MODE_PRIVATE).edit();
        for (String k : KEYS) {
            String val = call.getString(k);
            if (val != null) ed.putString(k, val);
        }
        ed.apply();
        LalWidget.refreshAll(ctx);
        JSObject ret = new JSObject();
        ret.put("ok", true);
        call.resolve(ret);
    }

    /** Recebe os cartões da semana (fundo, figura e textos) e guarda para o widget girar um por dia. */
    @PluginMethod
    public void art(PluginCall call) {
        JSArray cards = call.getArray("cards");
        if (cards == null || cards.length() == 0) { call.reject("sem cartões"); return; }
        Context ctx = getContext();
        getBridge().execute(() -> {
            try {
                SharedPreferences.Editor ed = ctx.getSharedPreferences(LalWidget.PREFS, Context.MODE_PRIVATE).edit();
                int n = Math.min(cards.length(), 14);
                for (int i = 0; i < n; i++) {
                    JSONObject c = cards.getJSONObject(i);
                    write(ctx, "widget_bg_" + i + ".jpg", c.getString("bg"));
                    String fig = c.optString("fig", "");
                    if (!fig.isEmpty()) write(ctx, "widget_fig_" + i + ".png", fig);
                    ed.putBoolean("artFig_" + i, !fig.isEmpty());
                    ed.putBoolean("artQ_" + i, fig.isEmpty());
                    ed.putString("artKick_" + i, c.optString("kick", ""));
                    ed.putString("artTitle_" + i, c.optString("title", ""));
                    ed.putString("artSub_" + i, c.optString("sub", ""));
                }
                ed.putInt("artN", n);
                ed.commit();
                LalWidget.refreshAll(ctx);
                JSObject ret = new JSObject();
                ret.put("ok", true);
                ret.put("n", n);
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("falha ao guardar a arte: " + e.getMessage());
            }
        });
    }

    private static void write(Context ctx, String name, String b64) throws Exception {
        byte[] data = Base64.decode(b64, Base64.DEFAULT);
        File tmp = new File(ctx.getFilesDir(), name + ".tmp");
        try (FileOutputStream out = new FileOutputStream(tmp)) { out.write(data); }
        if (!tmp.renameTo(new File(ctx.getFilesDir(), name))) throw new Exception("não renomeou " + name);
    }
}
