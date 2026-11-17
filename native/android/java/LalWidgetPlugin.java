package app.lancealance.coach;

import android.content.Context;
import android.content.SharedPreferences;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

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
}
