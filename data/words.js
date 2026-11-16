// Tricky Words: the word lists, in three modes a grown-up switches between.
// Year 1 and Year 2 are the national curriculum's common exception words. The Reception list is one school's:
// lists vary between schools. Ids, words, colours and tints match the game's source; only the labels differ (see UPSTREAM.md).
// Each word keeps its own capitals (I, Mr, Mrs, Christmas); everything else is lowercase.
// colour: the card border and tile edge. tint: the tile fill.
export const flashModes = [
  { id: 'r', label: 'Reception' },
  { id: '1', label: 'Year 1' },
  { id: '2', label: 'Year 2' }
];

export const flashDecks = [
  { id: 'yellow', mode: 'r', label: 'Tricky 1', colour: '#FFC000', tint: '#FFFF99',
    words: ['and', 'as', 'go', 'his', 'I', 'into', 'is', 'of', 'no', 'the', 'to'] },
  { id: 'purple', mode: 'r', label: 'Tricky 2', colour: '#B1A0C7', tint: '#CCC0DA',
    words: ['all', 'are', 'be', 'down', 'for', 'he', 'her', 'look', 'me', 'my', 'now', 'see', 'she', 'they', 'too', 'was', 'we', 'with', 'you'] },
  { id: 'green', mode: 'r', label: 'Tricky 3', colour: '#00B050', tint: '#C4D79B',
    words: ['children', 'come', 'do', 'have', 'like', 'little', 'one', 'out', 'said', 'some', 'so', 'were', 'there', 'what', 'when', 'went'] },
  // Year 1: the common exception words from the national curriculum, in curriculum order; colours from the first four of Year 2
  { id: 'y1t1', mode: '1', label: 'Tricky 1', colour: '#0E9AA7', tint: '#C3E6E9',
    words: ['the', 'a', 'do', 'to', 'today', 'of', 'said', 'says', 'are', 'were', 'was'] },
  { id: 'y1t2', mode: '1', label: 'Tricky 2', colour: '#FF6B6B', tint: '#FFDADA',
    words: ['is', 'his', 'has', 'I', 'you', 'your', 'they', 'be', 'he', 'me', 'she', 'we'] },
  { id: 'y1t3', mode: '1', label: 'Tricky 3', colour: '#3D348B', tint: '#CECCE2',
    words: ['no', 'go', 'so', 'by', 'my', 'here', 'there', 'where', 'love', 'come', 'some'] },
  { id: 'y1t4', mode: '1', label: 'Tricky 4', colour: '#FF9F43', tint: '#FFE7D0',
    words: ['one', 'once', 'ask', 'friend', 'school', 'put', 'push', 'pull', 'full', 'house', 'our'] },
  { id: 'tricky1', mode: '2', label: 'Tricky 1', colour: '#0E9AA7', tint: '#C3E6E9',
    words: ['after', 'again', 'any', 'bath', 'beautiful', 'because', 'behind', 'both', 'break', 'busy', 'child', 'children', 'Christmas'] },
  { id: 'tricky2', mode: '2', label: 'Tricky 2', colour: '#FF6B6B', tint: '#FFDADA',
    words: ['class', 'climb', 'clothes', 'could', 'cold', 'door', 'even', 'every', 'everybody', 'eye', 'fast', 'father', 'find'] },
  { id: 'tricky3', mode: '2', label: 'Tricky 3', colour: '#3D348B', tint: '#CECCE2',
    words: ['floor', 'gold', 'grass', 'great', 'half', 'hold', 'hour', 'improve', 'kind', 'last', 'many', 'mind', 'money'] },
  { id: 'tricky4', mode: '2', label: 'Tricky 4', colour: '#FF9F43', tint: '#FFE7D0',
    words: ['most', 'move', 'Mr', 'Mrs', 'old', 'only', 'parents', 'pass', 'past', 'path', 'people', 'plant', 'poor'] },
  { id: 'tricky5', mode: '2', label: 'Tricky 5', colour: '#4A90D9', tint: '#D2E3F6',
    words: ['pretty', 'prove', 'should', 'steak', 'sugar', 'sure', 'told', 'water', 'whole', 'who', 'wild', 'would'] }
];
