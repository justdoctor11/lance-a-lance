// Acrescenta ao projeto Android gerado pelo Capacitor as partes nativas do Lance a Lance:
// o widget da tela inicial e a ponte que o app usa para atualizá-lo.
// Roda depois de `npx cap add android` e `npx cap sync android`.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SRC = path.join(ROOT, 'native', 'android');
const APP = path.join(ROOT, 'android', 'app', 'src', 'main');
const PKG = path.join(APP, 'java', 'app', 'lancealance', 'coach');

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    const a = path.join(from, e.name), b = path.join(to, e.name);
    if (e.isDirectory()) copyDir(a, b); else fs.copyFileSync(a, b);
  }
}
function must(cond, msg) { if (!cond) { console.error('android-native: ' + msg); process.exit(1); } }

must(fs.existsSync(PKG), 'pasta do pacote não encontrada: ' + PKG);
copyDir(path.join(SRC, 'java'), PKG);
copyDir(path.join(SRC, 'res'), path.join(APP, 'res'));

// MainActivity: registra o plugin local antes de o Capacitor iniciar
const maPath = path.join(PKG, 'MainActivity.java');
let ma = fs.readFileSync(maPath, 'utf8');
if (!ma.includes('LalWidgetPlugin')) {
  must(/public class MainActivity extends BridgeActivity\s*\{\s*\}/.test(ma), 'MainActivity em formato inesperado');
  ma = ma.replace(/public class MainActivity extends BridgeActivity\s*\{\s*\}/, [
    'public class MainActivity extends BridgeActivity {',
    '    @Override',
    '    public void onCreate(android.os.Bundle savedInstanceState) {',
    '        registerPlugin(LalWidgetPlugin.class);',
    '        super.onCreate(savedInstanceState);',
    '    }',
    '',
    '    @Override',
    '    public void onPause() {',
    '        super.onPause();',
    '        LalWidget.refreshAll(this);',
    '    }',
    '}'
  ].join('\n'));
  fs.writeFileSync(maPath, ma);
}

// AndroidManifest: declara o widget
const mfPath = path.join(APP, 'AndroidManifest.xml');
let mf = fs.readFileSync(mfPath, 'utf8');
if (!mf.includes('.LalWidget')) {
  must(mf.includes('</application>'), 'AndroidManifest sem </application>');
  mf = mf.replace('</application>', [
    '    <receiver android:name=".LalWidget" android:exported="false" android:label="Lance a Lance">',
    '        <intent-filter>',
    '            <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />',
    '        </intent-filter>',
    '        <meta-data android:name="android.appwidget.provider" android:resource="@xml/lal_widget_info" />',
    '    </receiver>',
    '</application>'
  ].join('\n        '));
  fs.writeFileSync(mfPath, mf);
}
console.log('android-native: widget e ponte adicionados');
