param(
  [Parameter(Mandatory = $true)][string]$InputPath,
  [Parameter(Mandatory = $true)][string]$OutputPath
)

$ErrorActionPreference = 'Stop'
$word = $null
$document = $null

try {
  try {
    $word = New-Object -ComObject Word.Application
  } catch {
    [Console]::Error.WriteLine('DOCUMENT_ENGINE_MISSING')
    exit 42
  }

  $word.Visible = $false
  $word.DisplayAlerts = 0
  $document = $word.Documents.Open($InputPath, $false, $true)
  $document.ExportAsFixedFormat($OutputPath, 17)
} catch {
  [Console]::Error.WriteLine($_.Exception.Message)
  exit 1
} finally {
  if ($null -ne $document) {
    $document.Close(0)
    [void][Runtime.InteropServices.Marshal]::ReleaseComObject($document)
  }
  if ($null -ne $word) {
    $word.Quit()
    [void][Runtime.InteropServices.Marshal]::ReleaseComObject($word)
  }
  [GC]::Collect()
  [GC]::WaitForPendingFinalizers()
}
