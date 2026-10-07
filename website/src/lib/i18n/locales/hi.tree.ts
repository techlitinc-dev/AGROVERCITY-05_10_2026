import { registerLocale } from '../index';

/**
 * Tree plantation, NGO sapling requests and biofuel strings — merged into `hi`.
 * Identical key set to `en.tree.ts`.
 */

const hiTree: Record<string, string> = {
  treeTitle: 'वृक्षारोपण',
  treeHint: 'वृक्षारोपण की निगरानी, मुफ्त पौधों का अनुरोध और बायोफ्यूल अर्थशास्त्र।',

  treePlantationTitle: 'वृक्षारोपण ट्रैकर',
  treePlantationHint: 'प्रजाति, संख्या और जीवित दर के साथ आपके वृक्षारोपण।',
  treePlantationEmpty: 'अभी कोई वृक्षारोपण दर्ज नहीं।',
  treePlantationLoadFailed: 'आपके वृक्षारोपण लोड नहीं हो सके।',
  treePlantationSpecies: 'प्रजाति',
  treePlantationCount: '{count} पेड़',
  treePlantationCountLabel: 'पेड़ों की संख्या',
  treePlantationPlantedDate: 'रोपण {date}',
  treePlantationPlantedDateLabel: 'रोपण तिथि',
  treePlantationParcel: 'प्लॉट',
  treePlantationLatitude: 'अक्षांश',
  treePlantationLongitude: 'देशांतर',
  treePlantationSurvival: '{percent}% जीवित',
  treePlantationCarbon: '{kg} किग्रा CO₂e/वर्ष',
  treePlantationRegister: 'वृक्षारोपण दर्ज करें',
  treePlantationRegisterTitle: 'वृक्षारोपण जोड़ें',
  treePlantationRegistered: 'वृक्षारोपण दर्ज — जीवित दर जाँच आपके कार्यों में जोड़ी गई।',
  treePlantationInvalid: 'प्रजाति, संख्या और तारीख भरें।',

  treeNgoTitle: 'एनजीओ निर्देशिका',
  treeNgoHint: 'आपके आसपास मुफ्त पौधे देने वाले एनजीओ।',
  treeNgoEmpty: 'कोई एनजीओ नहीं मिला।',
  treeNgoLoadFailed: 'एनजीओ निर्देशिका लोड नहीं हो सकी।',
  treeNgoFree: 'मुफ्त पौधे',
  treeNgoTreesPlanted: '{count} पेड़ लगाए',
  treeNgoRating: 'रेटिंग {rating}',

  treeNgoRequest: 'पौधे मांगें',
  treeNgoRequestSpecies: 'प्रजाति प्रकार',
  treeNgoRequestCount: 'संख्या',
  treeSaplingTimber: 'इमारती लकड़ी',
  treeSaplingBiofuel: 'बायोफ्यूल',
  treeSaplingFruit: 'फल',
  treeSaplingBamboo: 'बांस',
  treeNgoRequestSubmit: 'अनुरोध भेजें',
  treeNgoRequested: 'पौधों का अनुरोध भेजा गया — स्थिति स्वीकृति की प्रतीक्षा में।',
  treeNgoRequestInvalid: '1 से 500 के बीच संख्या दर्ज करें।',

  treeNgoRequestsTitle: 'मेरे पौधों के अनुरोध',
  treeNgoRequestsEmpty: 'अभी कोई पौधों का अनुरोध नहीं।',
  treeNgoRequestsLoadFailed: 'आपके पौधों के अनुरोध लोड नहीं हो सके।',
  treeNgoStatus: 'स्थिति: {status}',

  treeBiofuelTitle: 'बायोफ्यूल अर्थशास्त्र',
  treeBiofuelHint: 'बायोफ्यूल वृक्ष प्रजातियाँ, लाभ और खरीदार बाज़ार।',
  treeBiofuelEmpty: 'बायोफ्यूल डेटा उपलब्ध नहीं।',
  treeBiofuelLoadFailed: 'बायोफ्यूल डेटा लोड नहीं हो सका।',
  treeBiofuelReturn: 'अनुमानित लाभ: {value}',
  treeBiofuelGestation: 'परिपक्वता: {value}',
  treeBiofuelOil: 'तेल मात्रा: {value}',
  treeBiofuelUses: 'उपयोग: {value}',
  treeBiofuelMarket: 'खरीदार बाज़ार: {value}',
  treeBiofuelSubsidy: 'अनुदान: {value}',
  treeBiofuelSuitability: 'उपयुक्तता: {value}',

  treeCareTitle: 'देखभाल मार्गदर्शिका',
  treeCareHint: 'छोटे पेड़ों की चरण-दर-चरण देखभाल।',
  treeCareEmpty: 'कोई देखभाल मार्गदर्शिका उपलब्ध नहीं।',
  treeCareLoadFailed: 'देखभाल मार्गदर्शिका लोड नहीं हो सकी।',
  treeCareStep: 'चरण {step}',
  treeCareStage: 'अवस्था: {value}',
  treeCareWatering: 'सिंचाई: {value}',
  treeCareFertilizer: 'खाद: {value}',
  treeCarePest: 'कीट सुरक्षा: {value}',
};

registerLocale('hi', hiTree);
