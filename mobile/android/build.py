#!/usr/bin/env python3
"""Build a signed, dependency-free Android APK with the official SDK tools.

Required: JAVA_HOME, ANDROID_SDK_ROOT, BW_ANDROID_KEYSTORE, BW_ANDROID_KEY_PASSWORD_FILE.
Use --qa only for an isolated localhost test APK; it is never the downloadable release.
"""
import os, pathlib, subprocess, shutil, sys, zipfile
root=pathlib.Path(__file__).resolve().parent
qa='--qa' in sys.argv
out=root/'out'/('qa' if qa else 'release')
if out.exists(): shutil.rmtree(out)
for folder in ['gen','classes','dex']: (out/folder).mkdir(parents=True,exist_ok=True)
sdk=pathlib.Path(os.environ['ANDROID_SDK_ROOT']); java=pathlib.Path(os.environ['JAVA_HOME'])/'bin'
bt=sdk/'build-tools/35.0.0'; android=sdk/'platforms/android-35/android.jar'
env=dict(os.environ);env['PATH']=str(java)+os.pathsep+env.get('PATH','')
env['BW_APK_SIGNING_SECRET']=pathlib.Path(env['BW_ANDROID_KEY_PASSWORD_FILE']).read_text().strip()
def run(*cmd): subprocess.run([str(x) for x in cmd],check=True,env=env)
manifest=(root/'AndroidManifest.xml').read_text()
if qa: manifest=manifest.replace('package="ru.blackandwhite.mobile"','package="ru.blackandwhite.mobile.qa"').replace('android:usesCleartextTraffic="false"','android:usesCleartextTraffic="true" android:debuggable="true"').replace('android:label="Black to White"','android:label="BW Local QA"')
(out/'AndroidManifest.xml').write_text(manifest)
origin='http://127.0.0.1:5196' if qa else 'https://blackandwhite-mos.ru'
config=out/'gen/ru/blackandwhite/mobile/BuildConfig.java';config.parent.mkdir(parents=True,exist_ok=True)
config.write_text('package ru.blackandwhite.mobile; public final class BuildConfig { public static final boolean DEBUG='+str(qa).lower()+'; public static final String ORIGIN="'+origin+'"; }')
run(bt/'aapt2','compile','--dir',root/'res','-o',out/'resources.zip')
run(bt/'aapt2','link','-o',out/'unsigned.apk','--manifest',out/'AndroidManifest.xml','-I',android,'--java',out/'gen','--custom-package','ru.blackandwhite.mobile','--min-sdk-version','26','--target-sdk-version','35','--version-code','1','--version-name','1.0.0',out/'resources.zip')
sources=list((root/'src').rglob('*.java'))+list((out/'gen').rglob('*.java'))
bootclasspath=str(android)+os.pathsep+str(bt/'core-lambda-stubs.jar')
run(java/'javac','-encoding','UTF-8','-source','8','-target','8','-bootclasspath',bootclasspath,'-d',out/'classes',*sources)
run(java/'jar','cf',out/'classes.jar','-C',out/'classes','.')
run(bt/'d8','--min-api','26','--lib',android,'--output',out/'dex',out/'classes.jar')
with zipfile.ZipFile(out/'unsigned.apk','a',compression=zipfile.ZIP_DEFLATED) as z:
    for f in (out/'dex').glob('*.dex'): z.write(f,f.name)
run(bt/'zipalign','-f','4',out/'unsigned.apk',out/'aligned.apk')
apk=out/('Black-to-White-QA.apk' if qa else 'Black-to-White.apk')
run(bt/'apksigner','sign','--ks',os.environ['BW_ANDROID_KEYSTORE'],'--ks-key-alias','blacktowhite','--ks-pass','env:BW_APK_SIGNING_SECRET','--key-pass','env:BW_APK_SIGNING_SECRET','--out',apk,out/'aligned.apk')
run(bt/'apksigner','verify','--verbose','--print-certs',apk)
print(apk)
