__all__ = ["addTextLayer"]

def addTextLayer():
      layer = guisystem.track.addNewLayer(TextModule, LocalState.localState().currentTransport.player.tCurrent, 60, 'Text')
      layer.findSequence('text').sequence.setString(0, "Hello world")
      return True
