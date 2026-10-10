# Hindi copy — review before merge

SPEC §10: *“Hindi strings reviewed by me before merge — do not invent financial Hindi, flag anything you are unsure of.”*

All rider-facing copy lives in `lib/strings.ts`. The app opens in **English**; Hindi is the switchable option (Home → हिंदी, Settings → Language, onboarding step 1). The Hindi is written the way a rider would say it — Hinglish where that is how people actually talk (“पेमेंट”, “OTP”, “UPI”) — not translated from the English. This file is generated: run `npm run hindi-review` after changing copy.

Rules applied everywhere (HR-8): never “instant”; withdrawals say **कल तक / अगले कामकाजी दिन तक**; no returns, interest or growth; never imply the money is invested; the rider is never charged (`noFees`).

**Kannada (SPEC §11 Q3) is not written.** Riders with `language = kn` see Hindi until it is.

## Flagged for your decision (18)

- **`floorHeld`** — “पेट्रोल-खाना”  
  Short label for “floor held back”. Alternative: “रोज़ का खर्च”.
- **`swept`** — “गुल्लक में”  
  “Swept to pots” → “गुल्लक में”. Natural for riders?
- **`ledgerNote`** — “पैसा आपके अपने बैंक खाते में ही रहता है। ऐप सिर्फ़ हिसाब रखता है।”  
  Explains HR-2 in one line. Is “हिसाब रखता है” clear enough for “ledger”?
- **`nothingSwept`** — “आज अभी ₹{floor} का खर्चा भी पूरा नहीं हुआ — कुछ नहीं कटा।”  
  SPEC S2 wording, kept verbatim (the floor amount is filled in).
- **`nudgeTitle`** — “₹{payout} अभी आया। किराया ₹{rent} अभी भेज दो?”  
  SPEC S4 wording, kept verbatim (amounts filled in).
- **`nudgeBody`** — “शाम तक पैसा खर्च हो जाता है। अभी भेजोगे तो किराया बाउंस नहीं होगा।”  
  SPEC S4 wording, kept verbatim.
- **`rentRecorded`** — “ठीक है, लिख लिया। फ़्लीट वाले भी चेक करेंगे।”  
  Sets the expectation that the fleet confirms — the operator report is authoritative.
- **`upiDemoWarning`** — “डेमो: यह नकली UPI ID है, कोई पैसा नहीं जाएगा”  
  Demo only.
- **`withdrawEta`** — “पैसा कल तक आपके बैंक में”  
  SPEC S3 asks for this exact line. But pots are a ledger (HR-2) — the money never left his bank — so “कल तक आपके बैंक में” may confuse. Keep it, or say “गुल्लक से हट जाएगा”?
- **`withdrawEtaSub`** — “अगले कामकाजी दिन तक (रविवार को नहीं)”  
  Only Sundays are skipped; bank holidays are not modelled yet.
- **`coverBorrowed`** — “उधार लिया”  
  PRIMARY METRIC. Must cover a friend, family and a moneylender alike. Does “उधार लिया” do that?
- **`coverUnpaid`** — “नहीं दे पाया”  
  PRIMARY METRIC. “नहीं दे पाया” = could not pay at all.
- **`splitRent`** — “किराया (जब तक पूरा न हो)”  
  Is a percentage split understandable at all, or should it move behind “और सेटिंग”?
- **`emergencyTarget`** — “इमरजेंसी की लिमिट”  
  “लिमिट” is Hinglish; alternative “कितना तक भरना है”.
- **`consentShareSub`** — “वो सिर्फ़ इतना देखेंगे: किराया दिया / नहीं दिया / लेट। आपकी कमाई, बचत या खर्चा कभी नहीं।”  
  DPDP consent copy — needs legal review as well as language review.
- **`obOtpDemo`** — “डेमो: SMS नहीं जाता। कोड {code} डालो।”  
  Demo only — goes away once Supabase phone OTP is connected.
- **`obConsentAppBody`** — “आप जो पेमेंट और खर्च लिखोगे, बस वही। हम SMS नहीं पढ़ते। आधार, बैंक पासवर्ड कुछ नहीं माँगते।”  
  DPDP consent copy — needs legal review. Makes three claims: no SMS read, no Aadhaar, no bank password.
- **`obConsentShareBody`** — “वो सिर्फ़ देखेंगे — किराया दिया, नहीं दिया, या लेट। कमाई और बचत कभी नहीं। कभी भी बंद कर सकते हो।”  
  DPDP consent copy — needs legal review.

## Every string (180)

| key | हिंदी | English | note |
|---|---|---|---|
| `appTagline` | रोज़ की कमाई से किराया और बचत | Rent and savings from daily earnings |  |
| `demoBadge` | डेमो | Demo |  |
| `demoNote` | डेमो डेटा — असली पैसा नहीं | Demo data — no real money |  |
| `navHome` | घर | Home |  |
| `navPots` | गुल्लक | Pots |  |
| `navHisab` | हिसाब | History |  |
| `navSettings` | सेटिंग | Settings |  |
| `back` | वापस | Back |  |
| `greeting` | नमस्ते, {name} | Hi, {name} |  |
| `safeToSpend` | आज खर्च कर सकते हो | Safe to spend today |  |
| `earnedToday` | आज कमाए | Earned today |  |
| `floorHeld` | पेट्रोल-खाना | Petrol + food | ⚠️ |
| `swept` | गुल्लक में | Into pots | ⚠️ |
| `floorProgress` | पेट्रोल-खाने का ₹{floor} — {pct}% पूरा | Petrol + food ₹{floor} — {pct}% covered |  |
| `floorDone` | पेट्रोल-खाने का पैसा पूरा ✓ | Petrol + food covered ✓ |  |
| `logPayout` | पेमेंट आया | Payment came |  |
| `logSpend` | खर्च हुआ | I spent |  |
| `shockPrompt` | कुछ खर्चा आ गया? | Sudden expense? |  |
| `shockPromptSub` | बाइक, दवा, फ़ोन — लिख लो | Bike, medicine, phone — note it |  |
| `ledgerNote` | पैसा आपके अपने बैंक खाते में ही रहता है। ऐप सिर्फ़ हिसाब रखता है। | The money stays in your own bank account. The app only keeps the account. | ⚠️ |
| `potRent` | किराया | Rent |  |
| `potEmergency` | इमरजेंसी | Emergency |  |
| `potSavings` | बचत | Savings |  |
| `potRentFor` | किराया बाउंस न हो, इसलिए सबसे पहले यहाँ | Filled first, so rent never bounces |  |
| `potEmergencyFor` | बाइक खराब हो या बीमार पड़ो — तब काम आएगा | For when the bike breaks or you fall sick |  |
| `potSavingsFor` | बाकी बचा पैसा, आगे के लिए | Everything else, for later |  |
| `rentDueToday` | किराया आज देना है | Rent due today |  |
| `rentDueIn` | {n} दिन में किराया | Rent due in {n} days |  |
| `rentOverdue` | किराया {n} दिन लेट | Rent {n} days late |  |
| `rentPaidThisCycle` | इस बार का किराया दे दिया ✓ | Paid for this cycle ✓ |  |
| `rentReady` | किराया पूरा जमा ✓ | Rent fully set aside ✓ |  |
| `rentNeedMore` | ₹{x} और चाहिए | ₹{x} more needed |  |
| `noRent` | किराया सेट नहीं है | No rent set up |  |
| `ofTarget` | ₹{target} में से | of ₹{target} |  |
| `noTarget` | कोई लिमिट नहीं | No limit |  |
| `withdraw` | निकालो | Withdraw |  |
| `history` | पूरा हिसाब | Full history |  |
| `noHistory` | अभी कुछ नहीं | Nothing yet |  |
| `fromPayout` | {source} से | from {source} |  |
| `withdrawnFor` | निकाला | Withdrawn |  |
| `pending` | आ रहा है | on its way |  |
| `howMuchCame` | कितना आया? | How much came? |  |
| `fromWhere` | कहाँ से? | From where? |  |
| `addPayout` | जोड़ो | Add |  |
| `sourceCash` | कैश | Cash |  |
| `sourceOther` | और | Other |  |
| `splitTitle` | ₹{amount} ऐसे बँटा | Your ₹{amount} was split like this |  |
| `keptForFloor` | पेट्रोल-खाने के लिए रखा | Kept for petrol + food |  |
| `keptForFloorSub` | यह खर्च करने के लिए है | This is yours to spend |  |
| `wentToPot` | {pot} गुल्लक में | To {pot} pot |  |
| `nothingSwept` | आज अभी ₹{floor} का खर्चा भी पूरा नहीं हुआ — कुछ नहीं कटा। | Today's ₹{floor} for petrol and food isn't covered yet — nothing was set aside. | ⚠️ |
| `carried` | ₹{x} बहुत छोटा है — अगले पेमेंट के साथ जुड़ेगा | ₹{x} is too small — it joins your next payment |  |
| `done` | ठीक है | OK |  |
| `howMuchSpent` | कितना खर्च हुआ? | How much did you spend? |  |
| `addSpend` | लिखो | Save |  |
| `spendSaved` | ₹{x} खर्च लिखा | Noted ₹{x} spent |  |
| `nudgeTitle` | ₹{payout} अभी आया। किराया ₹{rent} अभी भेज दो? | ₹{payout} just came. Send ₹{rent} rent now? | ⚠️ |
| `nudgeBody` | शाम तक पैसा खर्च हो जाता है। अभी भेजोगे तो किराया बाउंस नहीं होगा। | By evening the money gets spent. Send it now and the rent won't bounce. | ⚠️ |
| `nudgeYes` | हाँ, अभी भेजो | Yes, send now |  |
| `nudgeLater` | बाद में | Later |  |
| `payRentNow` | किराया अभी भेजो | Send rent now |  |
| `didYouSend` | भेज दिया? | Did you send it? |  |
| `didYouSendSub` | ₹{rent} किराया {payee} को — UPI ऐप में भेजा? | ₹{rent} rent to {payee} — sent from your UPI app? |  |
| `yes` | हाँ | Yes |  |
| `no` | नहीं | No |  |
| `rentRecorded` | ठीक है, लिख लिया। फ़्लीट वाले भी चेक करेंगे। | Noted. The fleet will confirm it too. | ⚠️ |
| `upiDemoWarning` | डेमो: यह नकली UPI ID है, कोई पैसा नहीं जाएगा | Demo: this is a fake UPI ID, no money will move | ⚠️ |
| `upiOpenFailed` | UPI ऐप नहीं खुला? फ़ोन में UPI ऐप होना चाहिए। | UPI app didn't open? You need a UPI app on this phone. |  |
| `withdrawFrom` | {pot} से निकालो | Withdraw from {pot} |  |
| `withdrawConfirm` | ₹{x} निकालें? | Withdraw ₹{x}? |  |
| `withdrawEta` | पैसा कल तक आपके बैंक में | Money in your bank by tomorrow | ⚠️ |
| `withdrawEtaSub` | अगले कामकाजी दिन तक (रविवार को नहीं) | By the next working day (not Sundays) | ⚠️ |
| `withdrawCta` | हाँ, निकालो | Yes, withdraw |  |
| `withdrawMax` | पूरा | All |  |
| `withdrawDone` | ₹{x} — कल तक बैंक में | ₹{x} — in your bank by next working day |  |
| `amountTooHigh` | गुल्लक में इतना नहीं है | The pot doesn't have that much |  |
| `shockTitle` | कुछ खर्चा आ गया? | Sudden expense? |  |
| `shockHowMuch` | कितने का? | How much? |  |
| `shockWhat` | क्या हुआ? | What happened? |  |
| `shockBike` | बाइक खराब | Bike repair |  |
| `shockPuncture` | पंक्चर | Puncture |  |
| `shockSick` | बीमार | Fell sick |  |
| `shockPhone` | फ़ोन | Phone |  |
| `shockFamily` | घर में | Family |  |
| `shockOther` | और कुछ | Something else |  |
| `shockHow` | पैसा कहाँ से दिया? | How did you pay for it? |  |
| `coverPot` | गुल्लक से | From my pots |  |
| `coverBorrowed` | उधार लिया | Borrowed | ⚠️ |
| `coverUnpaid` | नहीं दे पाया | Couldn't pay | ⚠️ |
| `coverOther` | और तरीके से | Some other way |  |
| `shockTakeFromPot` | इमरजेंसी गुल्लक से ₹{x} निकालें | Take ₹{x} from the emergency pot |  |
| `shockSave` | लिख लो | Save |  |
| `shockSaved` | लिख लिया। हिम्मत रखो। | Saved. Hang in there. |  |
| `hisabTitle` | हिसाब | History |  |
| `last14` | पिछले 14 दिन | Last 14 days |  |
| `earned` | कमाए | Earned |  |
| `sweptLegend` | गुल्लक में | Into pots |  |
| `bySource` | कहाँ से कितना (14 दिन) | Where it came from (14 days) |  |
| `payouts` | {n} पेमेंट | {n} payments |  |
| `shocksTitle` | अचानक खर्चे | Sudden expenses |  |
| `noShocks` | कोई अचानक खर्चा नहीं लिखा | No sudden expenses noted |  |
| `rentHistory` | किराया | Rent |  |
| `statusPaidOnTime` | टाइम पर | On time |  |
| `statusPaidLate` | लेट | Late |  |
| `statusMissed` | नहीं दिया | Missed |  |
| `statusDue` | बाकी | Due |  |
| `provisional` | आपने बताया | you said |  |
| `confirmed` | फ़्लीट ने माना | fleet confirmed |  |
| `settingsTitle` | सेटिंग | Settings |  |
| `floorTitle` | रोज़ का पेट्रोल-खाना | Daily petrol + food |  |
| `floorHelp` | इतना पैसा रोज़ खर्च के लिए रखा जाएगा। इससे ऊपर का पैसा गुल्लक में। | This much stays spendable every day. Money above it goes to your pots. |  |
| `splitTitle2` | बचत कैसे बँटे | How savings are split |  |
| `splitRent` | किराया (जब तक पूरा न हो) | Rent (until it's covered) | ⚠️ |
| `splitEmergency` | इमरजेंसी (बाकी में से) | Emergency (of the rest) |  |
| `splitHelp` | बचा हुआ बचत गुल्लक में जाता है। | Whatever's left goes to savings. |  |
| `emergencyTarget` | इमरजेंसी की लिमिट | Emergency pot limit | ⚠️ |
| `language` | भाषा | Language |  |
| `langComing` | जल्द | soon |  |
| `consentTitle` | आपकी मर्ज़ी | Your choices |  |
| `consentApp` | ऐप चलाने के लिए आपका हिसाब रखना | Keeping your account to run the app |  |
| `consentAppSub` | यह ज़रूरी है। हटाना हो तो नीचे 'मेरा डेटा मिटाओ' दबाओ। | Required. To remove it, use 'Delete my data' below. |  |
| `consentShare` | फ़्लीट वालों को किराया दिखाना | Show rent status to your fleet |  |
| `consentShareSub` | वो सिर्फ़ इतना देखेंगे: किराया दिया / नहीं दिया / लेट। आपकी कमाई, बचत या खर्चा कभी नहीं। | They see only: rent paid / not paid / late. Never your earnings, savings or spending. | ⚠️ |
| `consentShareOff` | बंद करने से आपकी बचत पर कोई असर नहीं। | Turning this off does not affect your savings. |  |
| `rentTitle` | किराया | Rent |  |
| `rentAmount` | कितना | Amount |  |
| `rentCadence` | कब | How often |  |
| `daily` | रोज़ | Daily |  |
| `weekly` | हफ़्ते में | Weekly |  |
| `dueDay` | किस दिन | Due day |  |
| `payee` | किसको | Paid to |  |
| `importTitle` | पेमेंट CSV से जोड़ो | Add payments from CSV |  |
| `importHelp` | कॉलम: date, time, amount, source | Columns: date, time, amount, source |  |
| `importDone` | {n} पेमेंट जुड़े | Added {n} payments |  |
| `importNone` | कोई नया पेमेंट नहीं मिला | No new payments found |  |
| `cohort` | ग्रुप | Group |  |
| `cohortPilot` | पायलट | Pilot |  |
| `cohortControl` | कंट्रोल | Control |  |
| `resetDemo` | डेमो फिर से शुरू करो | Restart the demo |  |
| `startFresh` | नया राइडर बनो | Start as a new rider |  |
| `deleteData` | मेरा डेटा मिटाओ | Delete my data |  |
| `deleteConfirm` | पक्का? सारा हिसाब इस फ़ोन से मिट जाएगा। | Sure? Your whole account will be erased from this phone. |  |
| `saved` | सेव हो गया | Saved |  |
| `noFees` | राइडर से कोई फ़ीस नहीं। कभी नहीं। | Riders never pay a fee. Ever. |  |
| `operatorLink` | फ़्लीट डैशबोर्ड (ऑपरेटर) | Fleet dashboard (operator) |  |
| `notifTitle` | किराया याद दिलाना | Rent reminders |  |
| `notifSub` | पेमेंट आने पर फ़ोन पर संदेश आएगा | Get a phone alert when a payment comes in |  |
| `notifBlocked` | फ़ोन की सेटिंग में नोटिफ़िकेशन बंद है | Notifications are blocked in phone settings |  |
| `floorSaved` | रोज़ का खर्च ₹{x} रखा | Daily spend set to ₹{x} |  |
| `obWelcome` | नमस्ते! | Welcome! |  |
| `obWelcomeSub` | रोज़ की कमाई में से किराया और बचत अपने-आप अलग। | Rent and savings set aside from your daily earnings, automatically. |  |
| `obStart` | शुरू करो | Get started |  |
| `obSeeDemo` | पहले डेमो देखो | See the demo first |  |
| `obPhone` | आपका मोबाइल नंबर | Your mobile number |  |
| `obSendOtp` | OTP भेजो | Send OTP |  |
| `obOtp` | OTP डालो | Enter OTP |  |
| `obOtpDemo` | डेमो: SMS नहीं जाता। कोड {code} डालो। | Demo: no SMS is sent. Enter code {code}. | ⚠️ |
| `obOtpWrong` | गलत OTP | Wrong OTP |  |
| `obLanguage` | भाषा चुनो | Choose language |  |
| `obName` | आपका नाम | Your name |  |
| `obOperator` | फ़्लीट कोड (अगर है) | Fleet code (if you have one) |  |
| `obOperatorHelp` | बाइक जिस कंपनी से किराए पर है, उनका कोड। नहीं है तो छोड़ दो। | The code of the company you rent your bike from. Skip if you don't have one. |  |
| `obOperatorUnknown` | यह कोड नहीं मिला | Code not found |  |
| `obSkip` | छोड़ो | Skip |  |
| `obRent` | बाइक का किराया | Bike rent |  |
| `obFloor` | रोज़ पेट्रोल-खाने में कितना लगता है? | How much do petrol and food cost you a day? |  |
| `obFloorHelp` | ज़्यादातर राइडर ₹300 रखते हैं। इससे ऊपर का पैसा गुल्लक में जाएगा। बाद में बदल सकते हो। | Most riders keep ₹300. Anything above it goes to your pots. You can change it later. |  |
| `obConsentApp` | हम आपका हिसाब रखेंगे | We'll keep your account |  |
| `obConsentAppBody` | आप जो पेमेंट और खर्च लिखोगे, बस वही। हम SMS नहीं पढ़ते। आधार, बैंक पासवर्ड कुछ नहीं माँगते। | Only the payments and spends you enter. We never read SMS. We never ask for Aadhaar or bank passwords. | ⚠️ |
| `obConsentShare` | फ़्लीट वालों को किराया दिखाएँ? | Show rent status to your fleet? |  |
| `obConsentShareBody` | वो सिर्फ़ देखेंगे — किराया दिया, नहीं दिया, या लेट। कमाई और बचत कभी नहीं। कभी भी बंद कर सकते हो। | They see only whether rent was paid, missed or late. Never your earnings or savings. Turn it off any time. | ⚠️ |
| `obAgree` | ठीक है | OK |  |
| `obAllow` | हाँ, दिखाओ | Yes, show it |  |
| `obDeny` | नहीं | No |  |
| `obNext` | आगे | Next |  |
| `obDone` | हो गया! | All set! |  |
| `obDoneSub` | अब जब भी पेमेंट आए, 'पेमेंट आया' दबाओ। | Whenever a payment comes, tap 'Payment came'. |  |
| `weekdays` | रवि,सोम,मंगल,बुध,गुरु,शुक्र,शनि | Sun,Mon,Tue,Wed,Thu,Fri,Sat |  |
| `rupee` | ₹ | ₹ |  |
| `loading` | खुल रहा है… | Opening… |  |
